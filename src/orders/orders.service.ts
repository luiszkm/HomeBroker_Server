import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import { InitTransactionDto, InputExecuteTransactionDto } from './order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prsimaService: PrismaService) { }
  initTransaction(input: InitTransactionDto) {
    return this.prsimaService.order.create({
      data: {
        ...input,
        partial: input.shares,
        status: OrderStatus.PENDING,
        version: 1
      }
    })
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
          id: input.order_id
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
          }
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
          }
        });
        if (walletAsset) {

          await prisma.walletAsset.update({
            where: {
              wallet_id_asset_id: {
                asset_id: order.asset_id,
                wallet_id: order.wallet_id
              }
            },
            data: {
              shares: walletAsset.shares + input.negotiated_shares,
            }
          })

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