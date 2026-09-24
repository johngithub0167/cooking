import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  mode: 'hash',
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('@/views/Home.vue'), meta: { title: '首页' } },
    { path: '/menu', name: 'menu', component: () => import('@/views/Menu.vue'), meta: { title: '总菜单' } },
    { path: '/today', name: 'today', component: () => import('@/views/TodayMenu.vue'), meta: { title: '今日菜单' } },
    { path: '/history', name: 'history', component: () => import('@/views/History.vue'), meta: { title: '历史记录' } },
    { path: '*', redirect: '/home' }
  ]
})
