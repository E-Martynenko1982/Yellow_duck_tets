import { Update, Start, Hears, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';

@Update()
export class BotUpdate {
  private userMapping: Record<number, { jiraName: string; tgName: string }> =
    {};

  constructor(private readonly configService: ConfigService) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.reply(
      'Hello! I am a Jira bot.\n\n1. Use `/link First Last` to link your Jira account.\n2. Press the "Report" button to see the team status.',
      {
        reply_markup: {
          keyboard: [[{ text: 'Report' }]],
          resize_keyboard: true,
        },
      },
    );
  }

  @Command('link')
  async onLink(@Ctx() ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const message = (ctx.message as { text: string }).text;
    const jiraName = message.replace('/link', '').trim();

    if (!jiraName) {
      return ctx.reply(
        'Please provide your name as in Jira. Example: `/link Evgeniy Martynenko`',
      );
    }

    this.userMapping[from.id] = { jiraName, tgName: from.first_name };

    await ctx.reply(
      `Done! ${from.first_name}, your Telegram is linked to Jira account: **${jiraName}**`,
    );
  }

  @Hears('Report')
  async onReport(@Ctx() ctx: Context) {
    await ctx.reply('Fetching data from Jira...');

    let report = '**Team workload:**\n\n';
    const mappedUsers = Object.values(this.userMapping);

    if (mappedUsers.length === 0) {
      return ctx.reply(
        'No members have linked their accounts yet. Use `/link`.',
      );
    }

    for (const user of mappedUsers) {
      const count = await this.getJiraTasks(user.jiraName);
      report += `**${user.jiraName}** (${user.tgName})\n- In progress: **${count}** tasks\n\n`;
    }

    await ctx.reply(report, { parse_mode: 'Markdown' });
  }

  private async getJiraTasks(assignee: string): Promise<number> {
    const domain = this.configService.get<string>('JIRA_DOMAIN');
    const email = this.configService.get<string>('JIRA_EMAIL');
    const token = this.configService.get<string>('JIRA_API_TOKEN');

    const jql = `assignee = "${assignee}" AND status IN ("In Progress", "Ready for qa")`;
    const url = `https://${domain}.atlassian.net/rest/api/3/search?jql=${encodeURIComponent(jql)}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
          Accept: 'application/json',
        },
      });
      const data = (await response.json()) as { total?: number };
      return data.total ?? 0;
    } catch (error) {
      console.error('Jira API Error:', error);
      return 0;
    }
  }
}
