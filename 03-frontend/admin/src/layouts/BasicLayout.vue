<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <el-menu :default-active="$route.path" router background-color="#304156" text-color="#bfcbd9" active-text-color="#409EFF">
        <div class="brand">家庭点菜后台</div>
        <el-menu-item index="/dashboard"><i class="el-icon-s-home" />首页</el-menu-item>
        <el-menu-item index="/dashboard/dishes"><i class="el-icon-food" />菜品管理</el-menu-item>
        <el-menu-item index="/dashboard/categories"><i class="el-icon-menu" />分类管理</el-menu-item>
        <el-menu-item index="/dashboard/records"><i class="el-icon-tickets" />点菜记录</el-menu-item>
      </el-menu>
    </aside>
    <section class="admin-main">
      <el-header class="admin-header">
        <span>{{ $route.meta.title || '管理后台' }}</span>
        <el-button type="text" @click="logout">退出</el-button>
      </el-header>
      <main class="admin-content"><router-view /></main>
    </section>
  </div>
</template>

<script>
export default {
  name: 'BasicLayout',
  methods: {
    logout () {
      this.$store.dispatch('logout')
      this.$router.replace({ name: 'login' })
    }
  }
}
</script>

<style>
.brand {
  height: 60px;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 600;
}
.el-menu {
  border-right: 0;
  min-height: 100vh;
}
.admin-header {
  height: 60px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}
</style>
