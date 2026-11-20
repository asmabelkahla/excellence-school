import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UserRole } from '../../../core/models/school.model';
import { AuthService } from '../../../core/services/auth.service';
import { MessagesApiService } from '../../../core/services/messages-api.service';

interface Tab {
  path: string;
  icon: string;
  label: string;
  badge?: 'messages';
}

/** The 4 most used destinations per role; everything else stays in the "Menu" drawer. */
const TABS: Record<UserRole, Tab[]> = {
  parent: [
    { path: '/parent/dashboard', icon: '🏠', label: 'Accueil' },
    { path: '/parent/homework', icon: '📚', label: 'Devoirs' },
    { path: '/parent/grades', icon: '📊', label: 'Notes' },
    { path: '/parent/messages', icon: '💬', label: 'Messages', badge: 'messages' }
  ],
  teacher: [
    { path: '/teacher/classes', icon: '🏫', label: 'Classes' },
    { path: '/teacher/homework', icon: '📚', label: 'Devoirs' },
    { path: '/teacher/grades', icon: '✏️', label: 'Notes' },
    { path: '/teacher/messages', icon: '💬', label: 'Messages', badge: 'messages' }
  ],
  econome: [
    { path: '/econome/finance', icon: '📈', label: 'Finances' },
    { path: '/econome/payments', icon: '💳', label: 'Paiements' },
    { path: '/econome/fees', icon: '🧾', label: 'Frais' }
  ],
  moderator: [
    { path: '/moderator/dashboard', icon: '🏠', label: 'Accueil' },
    { path: '/moderator/avis', icon: '⭐', label: 'Avis' },
    { path: '/moderator/services', icon: '🚌', label: 'Services' }
  ],
  admin: [
    { path: '/admin/dashboard', icon: '🏠', label: 'Accueil' },
    { path: '/admin/link-requests', icon: '👪', label: 'Inscriptions' },
    { path: '/admin/structure', icon: '🏫', label: 'École' },
    { path: '/admin/bulletins', icon: '📑', label: 'Bulletins' }
  ]
};

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterModule],
  template: `
    <nav class="bottom-nav no-print" aria-label="Navigation principale">
      @for (tab of tabs(); track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="active" #rla="routerLinkActive"
           [attr.aria-current]="rla.isActive ? 'page' : null" class="tab" (click)="menuClosed.emit()">
          <span class="tab-icon" aria-hidden="true">
            {{ tab.icon }}
            @if (tab.badge === 'messages' && messages.unread() > 0) {
              <span class="tab-badge">{{ messages.unread() > 9 ? '9+' : messages.unread() }}</span>
            }
          </span>
          <span class="tab-label">{{ tab.label }}</span>
          @if (tab.badge === 'messages' && messages.unread() > 0) {
            <span class="sr-only">, {{ messages.unread() }} non lu(s)</span>
          }
        </a>
      }
      <button type="button" class="tab" [class.active]="menuOpen" [attr.aria-expanded]="menuOpen"
              aria-controls="mobile-menu" (click)="menuToggled.emit()">
        <span class="tab-icon" aria-hidden="true">☰</span>
        <span class="tab-label">Menu</span>
      </button>
    </nav>
  `,
  styleUrls: ['./bottom-nav.component.scss']
})
export class BottomNavComponent {
  private readonly auth = inject(AuthService);
  readonly messages = inject(MessagesApiService);

  @Input() menuOpen = false;
  @Output() readonly menuToggled = new EventEmitter<void>();
  @Output() readonly menuClosed = new EventEmitter<void>();

  readonly tabs = computed(() => {
    const role = this.auth.currentRole();
    return role ? TABS[role] : [];
  });
}
