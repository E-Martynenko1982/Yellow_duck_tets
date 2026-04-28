import { Update, Start, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users/user.entity';

@Update()
export class BotUpdate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Start()
  async startCommand(@Ctx() ctx: Context) {
    const from = ctx.from;
    if (!from) return;

    let user = await this.userRepository.findOne({
      where: { telegramId: from.id.toString() },
    });

    if (!user) {
      user = this.userRepository.create({
        telegramId: from.id.toString(),
        firstName: from.first_name,
        username: from.username,
        isPm: true,
      });
      await this.userRepository.save(user);
    }

    await ctx.reply(
      `Вітаю, ${from.first_name}! Ви успішно зареєстровані в базі даних бота.`,
    );
  }
}
