import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import {
  Button, Cell, Empty, NavBar, Tabbar, TabbarItem, Toast,
  Search, List, PullRefresh, Stepper, Tag, Icon, Image as VanImage
} from 'vant'
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
Vue.use(Search)
Vue.use(List)
Vue.use(PullRefresh)
Vue.use(Stepper)
Vue.use(Tag)
Vue.use(Icon)
Vue.use(VanImage)

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
