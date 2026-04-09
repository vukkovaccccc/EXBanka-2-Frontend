/**
 * Trading API service — Celina 3.
 * Endpoints: /bank/trading/*
 */

import { apiGet, apiPost } from './grpcClient'
import type {
  TradingOrder,
  TradingOrderStatus,
  TradingCalculateRequest,
  TradingCalculateResponse,
  TradingCreateOrderRequest,
} from '@/types'

// ─── Backend response shapes (gRPC-Gateway camelCase) ─────────────────────────

interface BackendTradingOrder {
  id: string | number
  userId: string | number
  accountId: string | number
  listingId: string | number
  orderType: string
  direction: string
  quantity: number
  contractSize: number
  pricePerUnit?: string
  stopPrice?: string
  status: string
  approvedBy?: string | number
  isDone: boolean
  remainingPortions: number
  afterHours: boolean
  allOrNone: boolean
  margin: boolean
  lastModified: string
  createdAt: string
}

interface BackendCalculateResponse {
  pricePerUnit: string
  approximatePrice: string
  commission: string
  initialMarginCost?: string
}

function mapOrder(o: BackendTradingOrder): TradingOrder {
  return {
    id:                String(o.id),
    userId:            String(o.userId),
    accountId:         String(o.accountId),
    listingId:         String(o.listingId),
    orderType:         o.orderType as TradingOrder['orderType'],
    direction:         o.direction as TradingOrder['direction'],
    quantity:          o.quantity,
    contractSize:      o.contractSize,
    pricePerUnit:      o.pricePerUnit,
    stopPrice:         o.stopPrice,
    status:            o.status as TradingOrderStatus,
    approvedBy:        o.approvedBy !== undefined ? String(o.approvedBy) : undefined,
    isDone:            o.isDone,
    remainingPortions: o.remainingPortions,
    afterHours:        o.afterHours,
    allOrNone:         o.allOrNone,
    margin:            o.margin,
    lastModified:      o.lastModified,
    createdAt:         o.createdAt,
  }
}

// ─── TradingCalculate ─────────────────────────────────────────────────────────

/**
 * Calculates approximate price and commission/fee before order creation.
 * Does NOT persist anything — safe to call on every form change.
 */
export async function calculateOrder(
  req: TradingCalculateRequest
): Promise<TradingCalculateResponse> {
  const body = {
    orderType:    req.orderType,
    direction:    req.direction,
    listingId:    Number(req.listingId),
    quantity:     req.quantity,
    contractSize: req.contractSize,
    pricePerUnit: req.pricePerUnit ?? undefined,
    stopPrice:    req.stopPrice ?? undefined,
    margin:       req.margin,
    allOrNone:    req.allOrNone,
  }

  const res = await apiPost<typeof body, BackendCalculateResponse>(
    '/bank/trading/calculate',
    body
  )

  return {
    pricePerUnit:      res.pricePerUnit,
    approximatePrice:  res.approximatePrice,
    commission:        res.commission,
    initialMarginCost: res.initialMarginCost,
  }
}

// ─── TradingCreateOrder ───────────────────────────────────────────────────────

/** Creates a new trading order. Requires authentication. */
export async function createTradingOrder(
  req: TradingCreateOrderRequest
): Promise<TradingOrder> {
  const body = {
    accountId:    Number(req.accountId),
    listingId:    Number(req.listingId),
    orderType:    req.orderType,
    direction:    req.direction,
    quantity:     req.quantity,
    contractSize: req.contractSize,
    pricePerUnit: req.pricePerUnit ?? undefined,
    stopPrice:    req.stopPrice ?? undefined,
    afterHours:   req.afterHours,
    allOrNone:    req.allOrNone,
    margin:       req.margin,
  }

  const res = await apiPost<typeof body, { order: BackendTradingOrder }>(
    '/bank/trading/orders',
    body
  )

  return mapOrder(res.order)
}

// ─── TradingListOrders ────────────────────────────────────────────────────────

/** Lists ALL orders (supervisor/admin dashboard). Pass a status to filter. */
export async function listTradingOrders(
  status?: TradingOrderStatus
): Promise<TradingOrder[]> {
  const res = await apiGet<{ orders: BackendTradingOrder[] | null }>(
    '/bank/trading/orders',
    status ? { status } : undefined
  )
  return (res.orders ?? []).map(mapOrder)
}

/** Lists only the caller's own orders (Moji nalozi — all roles). */
export async function listMyTradingOrders(
  status?: TradingOrderStatus
): Promise<TradingOrder[]> {
  const res = await apiGet<{ orders: BackendTradingOrder[] | null }>(
    '/bank/trading/my-orders',
    status ? { status } : undefined
  )
  return (res.orders ?? []).map(mapOrder)
}

// ─── TradingApproveOrder ──────────────────────────────────────────────────────

/** Approves a PENDING order. Supervisor/Employee only. */
export async function approveTradingOrder(orderId: string): Promise<TradingOrder> {
  const res = await apiPost<Record<string, never>, { order: BackendTradingOrder }>(
    `/bank/trading/orders/${orderId}/approve`,
    {}
  )
  return mapOrder(res.order)
}

// ─── TradingDeclineOrder ──────────────────────────────────────────────────────

/** Declines a PENDING order. Supervisor/Employee only. */
export async function declineTradingOrder(orderId: string): Promise<TradingOrder> {
  const res = await apiPost<Record<string, never>, { order: BackendTradingOrder }>(
    `/bank/trading/orders/${orderId}/decline`,
    {}
  )
  return mapOrder(res.order)
}

// ─── TradingCancelOrder ───────────────────────────────────────────────────────

/** Cancels an active order. Available to the order owner or an Employee. */
export async function cancelTradingOrder(orderId: string): Promise<TradingOrder> {
  const res = await apiPost<Record<string, never>, { order: BackendTradingOrder }>(
    `/bank/trading/orders/${orderId}/cancel`,
    {}
  )
  return mapOrder(res.order)
}
