import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import { InitTransactionDto, InputExecuteTransactionDto } from './order.dto';
import { OrderStatus, OrderType } from '@prisma/client';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class OrdersService {
  constructor(
    private prsimaService: PrismaService,
    @Inject("ORDERS_PUBLISHER")
    private readonly kafkaClient: ClientKafka,
  ) { }

  all(filter: { wallet_id: string }) {
    return this.prsimaService.order.findMany({
      where: {
        wallet_id: filter.wallet_id
      },
      include: {
        Transactions: true,
        Asset: {
          select: {
            id: true,
            symbol: true,
          }
        }
      },
      orderBy: {
        updated_at: 'desc'
      }
    });
  }

  async initTransaction(input: InitTransactionDto) {
    const order = await this.prsimaService.order.create({
      data: {
        ...input,
        partial: input.shares,
        status: OrderStatus.PENDING,
        version: 1
      }
    })
    this.kafkaClient.emit('input', order)
    return order
  }
  async executeTransaction(input: InputExecuteTransactionDto) {
    return this.prsimaService.$transaction(async (prisma) => {
      const order = await prisma.order.findFirstOrThrow({
        where: {
          id: input.order_id
        },

      })
      await prisma.order.update({
        where: {
          id: input.order_id,
          version: order.version

        }, data: {
          partial: order.partial - input.negotiated_shares,
          status: input.status,
          Transactions: {
            create: {
              broker_transaction_id: input.broker_transaction_id,
              related_investor_id: input.related_investor_id,
              shares: input.negotiated_shares,
              price: input.price
            }
          },
          version: { increment: 1 }
        }
      });

      if (input.status === OrderStatus.CLOSED) {
        await prisma.order.update({
          where: {
            id: order.asset_id
          }, data: {
            price: input.price
          }
        });
        const walletAsset = await prisma.walletAsset.findUnique({
          where: {
            wallet_id_asset_id: {
              asset_id: order.asset_id,
              wallet_id: order.wallet_id
            }
          },

        });
        if (walletAsset) {

          await prisma.walletAsset.update({
            where: {
              wallet_id_asset_id: {
                asset_id: order.asset_id,
                wallet_id: order.wallet_id
              },
              version: order.version
            },
            data: {
              shares: order.type === OrderType.BUY ?
                walletAsset.shares + input.negotiated_shares :
                walletAsset.shares - input.negotiated_shares,
              version: { increment: 1 }
            }
          });
        } else {
          await prisma.walletAsset.create({
            data: {
              asset_id: order.asset_id,
              wallet_id: order.wallet_id,
              shares: input.negotiated_shares,
              version: 1
            }
          })
        }
      }

    });
  }
}