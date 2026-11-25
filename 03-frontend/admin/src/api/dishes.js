/**
 * 后台菜品接口封装（AD-013）
 * 字段严格按 02-design/api-design.md 第 3.4 / 3.5 节：
 *   GET    /api/admin/dishes               分页 + 筛选
 *   GET    /api/admin/dishes/:id           含 ingredients
 *   POST   /api/admin/dishes               新增
 *   PUT    /api/admin/dishes/:id           全量覆盖
 *   DELETE /api/admin/dishes/:id           逻辑删除
 *   PATCH  /api/admin/dishes/:id/status    { status }
 *   GET    /api/admin/ingredients?keyword= 食材联想（最多 20 条）
 *
 * 注意：列表必须显式带 page / pageSize —— 后端未设默认值，不传会报错。
 * request.js 响应拦截器成功时直接返回 payload.data，故这里不再拆 code/data。
 */
import request from '@/utils/request'

/** 菜品列表：强制携带 page 与 pageSize */
export function listDishes(params = {}) {
  return request({
    url: '/admin/dishes',
    method: 'get',
    params: {
      page: 1,
      pageSize: 20,
      ...params
    }
  })
}

/** 菜品详情（含 ingredients） */
export function getDish(id) {
  return request({
    url: `/admin/dishes/${id}`,
    method: 'get'
  })
}

/** 新增菜品 */
export function createDish(data) {
  return request({
    url: '/admin/dishes',
    method: 'post',
    data
  })
}

/** 编辑菜品（全量覆盖） */
export function updateDish(id, data) {
  return request({
    url: `/admin/dishes/${id}`,
    method: 'put',
    data
  })
}

/** 删除菜品（逻辑删除） */
export function deleteDish(id) {
  return request({
    url: `/admin/dishes/${id}`,
    method: 'delete'
  })
}

/** 上下架 */
export function updateDishStatus(id, status) {
  return request({
    url: `/admin/dishes/${id}/status`,
    method: 'patch',
    data: { status }
  })
}

/** 食材联想查询（最多 20 条） */
export function searchIngredients(keyword) {
  return request({
    url: '/admin/ingredients',
    method: 'get',
    params: { keyword }
  })
}
