/**
 * C 端菜单记录接口封装（FE-015）
 * 字段严格按 02-design/api-design.md 第 2.5/2.6/2.7 节：
 *   POST /api/menus    { mealDate?, remark?, items:[{dishId,quantity}] }
 *   GET  /api/menus    历史列表
 *   GET  /api/menus/:id 详情
 * C 端免鉴权；request.js 成功时直接返回 payload.data。
 */
import request from '@/utils/request'

/** 提交菜单：不传 mealDate，由服务端使用当天日期 */
export function createMenu(data) {
  return request({
    url: '/menus',
    method: 'post',
    data
  })
}

/** 历史菜单列表（备用） */
export function listMenus(params = {}) {
  return request({
    url: '/menus',
    method: 'get',
    params: {
      page: 1,
      pageSize: 20,
      ...params
    }
  })
}

/** 菜单详情（成功页用） */
export function getMenu(id) {
  return request({
    url: `/menus/${id}`,
    method: 'get'
  })
}
