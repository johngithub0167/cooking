/**
 * C 端分类接口封装（FE-011）
 * 字段严格按 02-design/api-design.md 第 2.1 节：
 *   GET /api/categories  → [{ id, name, sort }]，只含启用分类，按 sort 升序
 * C 端免鉴权；request.js 成功时直接返回 payload.data（数组）。
 */
import request from '@/utils/request'

/** 分类列表（启用，按 sort 升序） */
export function listCategories() {
  return request({
    url: '/categories',
    method: 'get'
  })
}
