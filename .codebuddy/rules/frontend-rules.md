# 前端开发规则

适用范围：`03-frontend/mobile/`、`03-frontend/admin/`

## 技术栈（不可更改）

- C 端：Vue 2.7 + Vant 2 + vue-router 3 + Vuex 3 + axios（Vue CLI 5 构建）
- 后台：Vue 2.7 + Element UI 2 + vue-router 3 + Vuex 3 + axios（Vue CLI 5 构建）

## 强制要求

1. **接口字段严格遵守 `02-design/api-design.md`**，不得自行发明字段名。
2. 统一请求封装在 `src/utils/request.js`：
   - baseURL `/api`；
   - `code !== 0` 时统一 toast 提示；
   - 后台遇 `1001` 清除 Token 并跳登录页。
3. **禁止 mock 掉真实接口来「假装完成」**，后端未就绪时用真实接口联调，或明确标注阻塞。
4. C 端今日菜单状态存 Vuex + localStorage，key 为 `cooking:cart:v1`。
5. 所有图片使用后端返回的相对路径；缺失时展示占位图。
6. C 端必须适配 375px 宽度，按钮点击区域不小于 44×44px。
7. 列表、空状态、加载中、加载失败四种状态必须都实现。
8. 搜索输入 300ms 防抖；提交按钮 loading 期间禁用。
9. 不引入文档中未列出的 UI 库或依赖。
10. 每个页面的验收标准见 `01-requirements/acceptance-criteria.md`，完成后逐条自检。

## 完成后

更新 `00-management/task-board.md` 中对应任务状态，并在 `00-management/progress.md` 追加一条记录。
