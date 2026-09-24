<template>
  <main class="page">
    <van-nav-bar title="今日菜单" />
    <section class="page__content">
      <h1 class="page__title">今日菜单</h1>
      <p v-if="!items.length" class="page__hint">菜单为空，先去首页看看推荐吧。</p>
      <van-empty v-if="!items.length" class="page__card" description="还没有选择菜品" />
      <van-cell-group v-else class="page__card">
        <van-cell v-for="item in items" :key="item.dishId" :title="item.dish && item.dish.name ? item.dish.name : `菜品 #${item.dishId}`" :value="`× ${item.quantity}`" />
      </van-cell-group>
    </section>
  </main>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TodayMenu',
  computed: {
    ...mapGetters('cart', ['items'])
  }
}
</script>
