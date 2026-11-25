<template>
  <main class="page success-page">
    <van-nav-bar title="提交成功" fixed placeholder />

    <section class="page__content">
      <div class="success-head">
        <van-icon name="checked" class="success-icon" />
        <h2 class="success-title">提交成功</h2>
        <p v-if="detail.mealDate" class="success-date">用餐日期：{{ detail.mealDate }}</p>
        <p v-else class="success-date">记录编号：#{{ recordId }}</p>
      </div>

      <!-- 详情加载中/失败兜底：不影响"提交成功"主提示 -->
      <div v-if="detailLoading" class="state-box">
        <van-loading size="24px">加载菜品清单...</van-loading>
      </div>
      <template v-else-if="detail.items && detail.items.length">
        <p class="section-title">共 {{ detail.itemCount || detail.items.length }} 份</p>
        <div class="dish-list">
          <div v-for="(item, idx) in detail.items" :key="idx" class="dish-row">
            <div class="dish-row__img">
              <img v-if="item.coverUrl && !imgFailed[idx]" :src="item.coverUrl" alt="" @error="markImgFailed(idx)">
              <div v-else class="dish-row__placeholder"><van-icon name="food-o" /></div>
            </div>
            <div class="dish-row__body">
              <p class="dish-row__name">{{ item.dishName }}</p>
              <p class="dish-row__qty">数量 × {{ item.quantity }}</p>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="state-box">
        <p class="fallback-tip">菜品清单暂时无法显示，可到历史记录查看。</p>
      </div>

      <div class="action-bar">
        <van-button type="primary" block round @click="goHistory">查看历史</van-button>
        <van-button plain block round class="action-secondary" @click="goMenu">再去点菜</van-button>
      </div>
    </section>
  </main>
</template>

<script>
import { getMenu } from '@/api/menus'

export default {
  name: 'Success',
  data() {
    return {
      detail: { mealDate: '', itemCount: 0, items: [] },
      detailLoading: false,
      imgFailed: {}
    }
  },
  computed: {
    recordId() {
      return this.$route.params.id
    }
  },
  created() {
    this.loadDetail()
  },
  methods: {
    loadDetail() {
      if (!this.recordId) return
      this.detailLoading = true
      getMenu(this.recordId)
        .then(data => {
          if (data) this.detail = data
        })
        .catch(() => {
          // 拿不到详情时降级：仍显示提交成功 + 记录编号（提示由 request.js 统一）
        })
        .finally(() => {
          this.detailLoading = false
        })
    },
    markImgFailed(idx) {
      this.$set(this.imgFailed, idx, true)
    },
    goHistory() {
      this.$router.push('/history')
    },
    goMenu() {
      this.$router.push('/menu')
    }
  }
}
</script>

<style scoped>
.success-page {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.success-head {
  text-align: center;
  padding: 24px 0 12px;
}
.success-icon {
  font-size: 56px;
  color: #07c160;
}
.success-title {
  margin: 12px 0 6px;
  font-size: 20px;
  color: #323233;
}
.success-date {
  margin: 0;
  font-size: 13px;
  color: #969799;
}
.section-title {
  margin: 12px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.dish-list {
  margin-bottom: 8px;
}
.dish-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
}
.dish-row__img {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
}
.dish-row__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.dish-row__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: #f7f8fa;
  color: #c0c4cc;
  font-size: 24px;
}
.dish-row__body {
  flex: 1 1 auto;
  min-width: 0;
}
.dish-row__name {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dish-row__qty {
  margin: 0;
  font-size: 12px;
  color: #969799;
}
.state-box {
  padding: 24px 16px;
  text-align: center;
}
.fallback-tip {
  font-size: 13px;
  color: #969799;
}
.action-bar {
  margin-top: 20px;
}
.action-bar .van-button {
  min-height: 44px;
}
.action-secondary {
  margin-top: 10px;
}
</style>
