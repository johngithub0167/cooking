<template>
  <div id="app">
    <router-view />
    <van-tabbar v-model="activeTab" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/menu" icon="apps-o">总菜单</van-tabbar-item>
      <van-tabbar-item replace to="/today" icon="cart-o" :badge="totalQuantity || null">今日菜单</van-tabbar-item>
      <van-tabbar-item replace to="/history" icon="clock-o">历史</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'App',
  computed: {
    ...mapGetters('cart', ['totalQuantity']),
    activeTab: {
      get () {
        return this.$route.path
      },
      set () {}
    }
  }
}
</script>
