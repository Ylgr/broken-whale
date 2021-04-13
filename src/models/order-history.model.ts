import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: true}})
export class OrderHistory extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id?: number;

  @property({
    type: 'number',
    required: true,
  })
  account_id: number;

  @property({
    type: 'string',
    required: true,
  })
  symbol: string;

  @property({
    type: 'number',
    dataType: 'float',
    required: true,
  })
  open_amount: number;

  @property({
    type: 'number',
    dataType: 'float',
  })
  close_amount?: number;

  @property({
    type: 'number',
    dataType: 'float',
  })
  open_price?: number;

  @property({
    type: 'number',
    dataType: 'float',
  })
  close_price?: number;

  @property({
    type: 'boolean',
    default: true,
  })
  is_active?: boolean;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  created_at?: Date;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  updated_at?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<OrderHistory>) {
    super(data);
  }
}

export interface OrderHistoryRelations {
  // describe navigational properties here
}

export type OrderHistoryWithRelations = OrderHistory & OrderHistoryRelations;
