import Vue from 'vue'
import Router from 'vue-router'
import store from '@/store'

Vue.use(Router)

const router = new Router({
  mode: 'hash',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', name: 'login', component: () => import('@/pages/Login.vue'), meta: { public: true } },
    {
      path: '/dashboard',
      component: () => import('@/layouts/BasicLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/Dashboard.vue'), meta: { title: '首页' } },
        { path: 'dishes', name: 'dishes', component: () => import('@/pages/Dishes.vue'), meta: { title: '菜品管理' } },
        { path: 'categories', name: 'categories', component: () => import('@/pages/Categories.vue'), meta: { title: '分类管理' } },
        { path: 'records', name: 'records', component: () => import('@/pages/Records.vue'), meta: { title: '点菜记录' } }
      ]
    },
    { path: '*', redirect: '/dashboard' }
  ]
})

router.beforeEach((to, from, next) => {
  if (to.meta && to.meta.public) return next()
  if (!store.getters.isAuthenticated) return next({ name: 'login', query: { redirect: to.fullPath } })
  next()
})

export default router
