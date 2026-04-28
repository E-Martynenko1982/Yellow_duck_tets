import { Controller, Post, Body } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';

interface JiraIssueFields {
  summary: string;
  status: {
    name: string;
  };
}

interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

interface JiraUser {
  displayName: string;
}

interface JiraWebhookPayload {
  issue?: JiraIssue;
  user?: JiraUser;
}

@Controller('jira')
export class JiraController {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  async handleWebhook(@Body() data: JiraWebhookPayload) {
    const issueKey = data.issue?.key;
    const summary = data.issue?.fields?.summary;
    const status = data.issue?.fields?.status?.name;
    const user = data.user?.displayName;

    const message = `🔔 **Jira Update**\n\n📌 Завдання: ${issueKey} - ${summary}\n🔄 Статус: ${status}\n👤 Зміни вніс: ${user}`;

    const groupId = this.configService.getOrThrow<string>('TELEGRAM_GROUP_ID');
    await this.bot.telegram.sendMessage(groupId, message, {
      parse_mode: 'Markdown',
    });

    return { status: 'ok' };
  }
}
