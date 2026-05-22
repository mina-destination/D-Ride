import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Roles('PASSENGER', 'OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION', 'DRIVER')
  @Post('submit')
  async submitTicket(@Request() req: any, @Body() data: SubmitTicketDto) {
    return this.supportService.submitTicket(req.user.sub, data);
  }

  @Roles('ADMIN')
  @Get('tickets')
  async getTickets() {
    return this.supportService.getAllTickets();
  }

  @Roles('ADMIN')
  @Put('tickets/:id/resolve')
  async resolveTicket(@Param('id') id: string) {
    return this.supportService.resolveTicket(id);
  }

  @Roles('ADMIN')
  @Post('tickets/:id/reply')
  async replyToTicket(@Param('id') id: string, @Body() data: ReplyTicketDto) {
    return this.supportService.replyToTicket(id, data.text, data.adminName);
  }
}
