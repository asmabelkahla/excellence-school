import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterParentDto } from './dto/register-parent.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ReviewLinkRequestDto } from './dto/review-link-request.dto';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleCredentialDto, GoogleRegisterDto } from './dto/google.dto';
import { AllowPendingPasswordChange, AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleAuthService,
  ) {}

  // Brute-force protection: 5 attempts / minute / IP.
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.identifier, loginDto.password);
  }

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  registerParent(@Body() registerParentDto: RegisterParentDto) {
    return this.authService.registerParent(registerParentDto);
  }

  /** Public: Google client id (null = Google sign-in disabled). */
  @Get('google/config')
  googleConfig() {
    return this.google.config();
  }

  /** Sign in with a Google ID token; unknown account → registration token for step 2. */
  @Post('google')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  googleSignIn(@Body() dto: GoogleCredentialDto) {
    return this.google.signIn(dto.credential);
  }

  /** Step 2 of a Google registration: phone, relationship and children. */
  @Post('google/register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  googleRegister(@Body() dto: GoogleRegisterDto) {
    return this.google.register(dto);
  }

  /** Public: class names for the registration form. */
  @Get('classes')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  publicClasses() {
    return this.authService.publicClasses();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.findById(req.user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthenticatedRequest) {
    return this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }

  @Post('invite-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  inviteStaff(@Body() inviteStaffDto: InviteStaffDto, @Req() req: AuthenticatedRequest) {
    return this.authService.inviteStaff({ ...inviteStaffDto, invitedById: req.user.sub });
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getUsers() {
    return this.authService.getUsers();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getUser(@Param('id') id: string) {
    return this.authService.findById(id);
  }

  @Get('link-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getLinkRequests() {
    return this.authService.getLinkRequests();
  }

  @Post('link-requests/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reviewLinkRequest(@Param('id') id: string, @Body() dto: ReviewLinkRequestDto) {
    return this.authService.reviewLinkRequest(id, dto);
  }
}
