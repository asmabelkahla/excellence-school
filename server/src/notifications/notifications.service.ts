import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { NotificationEntity, NotificationType, PushSubscriptionEntity } from './entities';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  /** In-app route opened when the notification is tapped, e.g. /parent/homework */
  link?: string;
  studentId?: string;
}

/**
 * Stores in-app notifications and mirrors them as Web Push notifications
 * on every device the user enabled. Push failures never break the caller.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger('Notifications');
  private publicKey: string | null = null;

  constructor(
    @InjectRepository(NotificationEntity) private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(PushSubscriptionEntity) private readonly subscriptions: Repository<PushSubscriptionEntity>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    let publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:contact@excellence-school.tn');

    if (!publicKey || !privateKey) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.warn('VAPID keys missing: push notifications are disabled (in-app notifications still work).');
        return;
      }
      // Dev only: temporary keys. Devices must re-subscribe after each restart.
      ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
      this.logger.warn('VAPID keys missing: using temporary dev keys (run `npx web-push generate-vapid-keys`).');
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  get pushPublicKey(): string | null {
    return this.publicKey;
  }

  /** Creates one in-app notification per user and pushes it to their devices. */
  async notify(userIds: string[], input: NotifyInput): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (!unique.length) return;
    const now = new Date();
    await this.notifications.insert(
      unique.map(userId => ({
        id: `ntf-${randomUUID()}`,
        user_id: userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        student_id: input.studentId ?? null,
        created_at: now,
        read_at: null,
      })),
    );
    // Fire and forget: a slow push service must not delay the HTTP answer.
    void this.push(unique, input).catch(err => this.logger.warn(`push failed: ${err?.message ?? err}`));
  }

  async list(userId: string) {
    return this.notifications.find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 50 });
  }

  async unreadCount(userId: string) {
    return { unread: await this.notifications.count({ where: { user_id: userId, read_at: IsNull() } }) };
  }

  async markRead(userId: string, id?: string) {
    await this.notifications.update(
      id ? { id, user_id: userId, read_at: IsNull() } : { user_id: userId, read_at: IsNull() },
      { read_at: new Date() },
    );
    return this.unreadCount(userId);
  }

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    // An endpoint belongs to one browser: re-assign it if another account used this device before.
    await this.subscriptions.save({
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent?.slice(0, 300) ?? null,
      created_at: new Date(),
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.subscriptions.delete({ endpoint, user_id: userId });
    return { subscribed: false };
  }

  private async push(userIds: string[], input: NotifyInput) {
    if (!this.publicKey) return;
    const subs = await this.subscriptions.find({ where: { user_id: In(userIds) } });
    if (!subs.length) return;

    // Format understood by Angular's service worker (ngsw): shows the notification and
    // opens / focuses the app on the right page when it is tapped.
    const payload = JSON.stringify({
      notification: {
        title: input.title,
        body: input.body,
        icon: 'icons/icon-192.png',
        badge: 'icons/favicon-32.png',
        tag: `${input.type}-${input.studentId ?? 'all'}`,
        renotify: true,
        data: {
          onActionClick: {
            default: { operation: 'navigateLastFocusedOrOpen', url: input.link ?? '/' },
          },
        },
      },
    });

    await Promise.all(
      subs.map(async s => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
        } catch (err: any) {
          // 404/410: the browser dropped this subscription (uninstalled app, revoked permission).
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await this.subscriptions.delete({ endpoint: s.endpoint });
          } else {
            this.logger.warn(`push to ${s.user_id} failed: ${err?.statusCode ?? ''} ${err?.message ?? err}`);
          }
        }
      }),
    );
  }
}
