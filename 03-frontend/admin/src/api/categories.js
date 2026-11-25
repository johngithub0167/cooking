/**
 * 后台分类接口封装（AD-012）
 * 字段严格按 02-design/api-design.md 第 3.3 节：
 *   GET    /api/admin/categories             全部分类（含停用）
 *   POST   /api/admin/categories             { name, sort?, status? }
 *   PUT    /api/admin/categories/:id         部分更新
 *   DELETE /api/admin/categories/:id         返回 { affectedDishes }
 * request.js 响应拦截器成功时直接返回 payload.data，故这里不再拆 code/data。
 */
import request from '@/utils/request'

/** 分类列表（含停用，按 sort 升序） */
export function listCategories() {
  return request({
    url: '/admin/categories',
    method: 'get'
  })
}

/** 新增分类 */
export function createCategory(data) {
  return request({
    url: '/admin/categories',
    method: 'post',
    data
  })
}

/** 修改分类（传 id + 需变更的字段） */
export function updateCategory(id, data) {
  return request({
    url: `/admin/categories/${id}`,
    method: 'put',
    data
  })
}

/** 删除分类，返回 { affectedDishes } */
export function deleteCategory(id) {
  return request({
    url: `/admin/categories/${id}`,
    method: 'delete'
  })
}
