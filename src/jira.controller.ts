import { Controller, Post, Body } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';

interface JiraChangelogItem {
  field: string;
  fromString?: string;
  toString?: string;
}

interface JiraChangelog {
  items: JiraChangelogItem[];
}

interface JiraAssignee {
  displayName: string;
}

interface JiraIssueFields {
  summary: string;
  assignee?: JiraAssignee;
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
  changelog?: JiraChangelog;
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
    const issue = data.issue;
    const changelog = data.changelog;

    if (!issue) return { status: 'no issue data' };

    const issueKey = issue.key;
    const summary = issue.fields.summary;
    const assignee = issue.fields.assignee?.displayName ?? 'Unassigned';
    const userWhoChanged = data.user?.displayName ?? 'System';
    const jiraUrl = `https://motor8103.atlassian.net/browse/${issueKey}`;

    let statusText = '';
    let otherChanges = '';

    if (changelog?.items) {
      changelog.items.forEach((item: JiraChangelogItem) => {
        if (item.field === 'status') {
          statusText = `\nStatus Change:\n\`${item.fromString ?? 'Start'}\` -> \`${item.toString ?? ''}\`\n`;
        } else {
          const from = item.fromString ? `\`${item.fromString}\` -> ` : '';
          otherChanges += `- ${item.field}: ${from}\`${item.toString ?? ''}\`\n`;
        }
      });
    }

    const message = [
      `Jira Notification`,
      `\nTask: ${issueKey} - ${summary}`,
      `Assignee: ${assignee}`,
      statusText,
      otherChanges ? `Other changes:\n${otherChanges}` : '',
      `\nChanged by: ${userWhoChanged}`,
      `\nOpen in Jira: ${jiraUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    const groupId = this.configService.getOrThrow<string>('TELEGRAM_GROUP_ID');

    await this.bot.telegram.sendMessage(groupId, message, {
      parse_mode: 'Markdown',
    });

    return { status: 'ok' };
  }
}
