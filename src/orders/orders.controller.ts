import { Body, Controller, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { InitTransactionDto, InputExecuteTransactionDto } from './order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  initTransaction(@Body() body: InitTransactionDto){
    return this.ordersService.initTransaction(body)
  }

  @Post('execute')
  executeTransaction(@Body() body: InputExecuteTransactionDto){
   return this.ordersService.executeTransaction(body)
  }
}
