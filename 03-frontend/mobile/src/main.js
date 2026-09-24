import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import { Button, Cell, Empty, NavBar, Tabbar, TabbarItem, Toast } from 'vant'
import 'vant/lib/index.css'
import './styles/base.css'

Vue.config.productionTip = false

Vue.use(Button)
Vue.use(Cell)
Vue.use(Empty)
Vue.use(NavBar)
Vue.use(Tabbar)
Vue.use(TabbarItem)
Vue.use(Toast)

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
