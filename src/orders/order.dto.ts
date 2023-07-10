import { OrderType } from '@prisma/client';

export class InitTransactionDto {
  wallet_id: string;
  asset_id: string;
  shares: number;
  price: number;
  type: OrderType;
}

export class InputExecuteTransactionDto {
  order_id: string;
  status: 'OPEN' | 'CLOSED';
  related_investor_id: string;
  broker_transaction_id: string;
  negotiated_shares: number;
  price: number;
}
