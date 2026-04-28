import { Update, Start, Hears, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users/user.entity';

@Update()
export class BotUpdate {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    const existing = await this.userRepository.findOne({
      where: { telegramId: from.id.toString() },
    });

    if (!existing) {
      await this.userRepository.save(
        this.userRepository.create({
          telegramId: from.id.toString(),
          firstName: from.first_name,
          username: from.username,
        }),
      );
    }

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

    await this.userRepository.upsert(
      {
        telegramId: from.id.toString(),
        firstName: from.first_name,
        username: from.username,
        jiraName,
      },
      ['telegramId'],
    );

    await ctx.reply(
      `Done! ${from.first_name}, your Telegram is linked to Jira account: **${jiraName}**`,
    );
  }

  @Hears('Report')
  async onReport(@Ctx() ctx: Context) {
    await ctx.reply('Fetching data from Jira...');

    const users = await this.userRepository.find();
    const linkedUsers = users.filter((u) => u.jiraName);

    if (linkedUsers.length === 0) {
      return ctx.reply(
        'No members have linked their accounts yet. Use `/link`.',
      );
    }

    let report = '**Team workload:**\n\n';

    for (const user of linkedUsers) {
      const count = await this.getJiraTasks(user.jiraName);
      report += `**${user.jiraName}** (${user.firstName})\n- In progress: **${count}** tasks\n\n`;
    }

    await ctx.reply(report, { parse_mode: 'Markdown' });
  }

  private async getJiraTasks(assignee: string): Promise<number> {
    const domain = this.configService.get<string>('JIRA_DOMAIN');
    const email = this.configService.get<string>('JIRA_EMAIL');
    const token = this.configService.get<string>('JIRA_API_TOKEN');

    if (!domain) return 0;

    const jql = `assignee = '${assignee}' AND status IN ('In Progress', 'IN PROGRESS', 'Ready for QA', 'READY FOR QA')`;

    const baseUrl = domain.includes('atlassian.net')
      ? domain
      : `${domain}.atlassian.net`;
    const url = `https://${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}`;

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
