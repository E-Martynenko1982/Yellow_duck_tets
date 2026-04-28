import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TypeOrmModule } from '@nestjs/typeorm';
import LocalSession from 'telegraf-session-local';
import { AppController } from './app.controller';
import { JiraController } from './jira.controller';
import { AppService } from './app.service';
import { BotUpdate } from './bot.update';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [User],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),

    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        middlewares: [
          new LocalSession({ database: 'sessions.json' }).middleware(),
        ],
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AppController, JiraController],
  providers: [AppService, BotUpdate],
})
export class AppModule {}
