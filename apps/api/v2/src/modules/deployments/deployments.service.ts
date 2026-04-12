import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeploymentsRepository } from "@/modules/deployments/deployments.repository";
import { RedisService } from "@/modules/redis/redis.service";

const CACHING_TIME = 86400000; // 24 hours in milliseconds

const getLicenseCacheKey = (key: string) => `api-v2-license-key-goblin-url-${key}`;

type LicenseCheckResponse = {
  status: boolean;
};
@Injectable()
export class DeploymentsService {
  constructor(
    private readonly deploymentsRepository: DeploymentsRepository,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async checkLicense() {
    return true;
  }
}
