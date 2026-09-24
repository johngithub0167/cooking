<template>
  <div class="login-page">
    <el-card class="login-card">
      <h1>家庭点菜管理后台</h1>
      <p>登录页面将在 AD-010 实现。</p>
      <el-button type="primary" @click="continueToDashboard">进入工程骨架</el-button>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'Login',
  methods: {
    continueToDashboard () {
      this.$message.info('登录业务将在 AD-010 实现')
    }
  }
}
</script>

<style>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.login-card {
  width: 420px;
}
.login-card h1 {
  margin: 0 0 16px;
  font-size: 22px;
}
</style>
