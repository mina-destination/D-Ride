import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [NotificationsService, MailService],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
