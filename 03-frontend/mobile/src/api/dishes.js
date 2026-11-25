/**
 * C 端菜品接口封装（FE-011 / FE-012）
 * 字段严格按 02-design/api-design.md 第 2.2 / 2.3 节：
 *   GET /api/dishes?page&pageSize&categoryId&keyword
 *   GET /api/dishes/:id
 * C 端免鉴权；request.js 响应拦截器成功时直接返回 payload.data。
 */
import request from '@/utils/request'

/** 菜品列表：显式携带 page/pageSize（后端默认 1/20，这里也带上更稳妥） */
export function listDishes(params = {}) {
  return request({
    url: '/dishes',
    method: 'get',
    params: {
      page: 1,
      pageSize: 20,
      ...params
    }
  })
}

/** 菜品详情（字段同列表项，含 ingredients） */
export function getDish(id) {
  return request({
    url: `/dishes/${id}`,
    method: 'get'
  })
}
