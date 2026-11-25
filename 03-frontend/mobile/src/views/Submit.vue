<template>
  <main class="page submit-page">
    <van-nav-bar title="提交菜单" fixed placeholder left-text="返回" left-arrow @click-left="goBack" />

    <section class="page__content">
      <!-- 空状态 -->
      <div v-if="itemCount === 0" class="state-box">
        <van-empty image="cart" description="今日菜单还没有菜品" />
        <van-button type="primary" size="small" round @click="goMenu">去总菜单</van-button>
      </div>

      <template v-else>
        <p class="section-title">本次提交（共 {{ itemCount }} 道 / {{ totalQuantity }} 份）</p>
        <div class="dish-list">
          <div v-for="item in items" :key="item.dishId" class="dish-row">
            <div class="dish-row__img">
              <img v-if="imageOf(item) && !imgFailed[item.dishId]" :src="imageOf(item)" alt="" @error="markImgFailed(item.dishId)">
              <div v-else class="dish-row__placeholder"><van-icon name="food-o" /></div>
            </div>
            <div class="dish-row__body">
              <p class="dish-row__name">{{ nameOf(item) }}</p>
              <p class="dish-row__qty">数量 × {{ item.quantity }}</p>
            </div>
          </div>
        </div>

        <van-field
          v-model="remark"
          rows="2"
          autosize
          type="textarea"
          maxlength="200"
          show-word-limit
          label="备注"
          placeholder="选填，不超过 200 字"
          :disabled="submitting"
        />

        <p class="hint">用餐日期由系统自动取当天，无需填写。</p>

        <div class="submit-bar">
          <van-button
            type="primary"
            block
            round
            :loading="submitting"
            :disabled="submitting || itemCount === 0"
            @click="onSubmit"
          >{{ submitting ? '提交中...' : '确认提交' }}</van-button>
        </div>
      </template>
    </section>
  </main>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { createMenu } from '@/api/menus'

export default {
  name: 'Submit',
  data() {
    return {
      remark: '',
      submitting: false,
      imgFailed: {}
    }
  },
  computed: {
    ...mapGetters('cart', ['items', 'itemCount', 'totalQuantity'])
  },
  methods: {
    ...mapActions('cart', ['clear']),

    nameOf(item) {
      return item.dish && item.dish.name ? item.dish.name : `菜品 #${item.dishId}`
    },

    imageOf(item) {
      if (!item.dish) return ''
      return item.dish.thumbUrl || item.dish.coverUrl || ''
    },

    markImgFailed(id) {
      this.$set(this.imgFailed, id, true)
    },

    onSubmit() {
      if (this.submitting || this.itemCount === 0) return
      this.submitting = true
      const payload = {
        remark: this.remark || '',
        items: this.items.map(item => ({ dishId: item.dishId, quantity: item.quantity }))
      }
      // 不传 mealDate：由服务端使用当天
      createMenu(payload)
        .then(data => {
          // 接口成功后才清空本地菜单（AC-C-07-04），失败不清空（AC-C-07-05）
          this.clear()
          this.$router.replace({ name: 'success', params: { id: data.id } })
        })
        .catch(() => {
          // 失败提示由 request.js 统一 Toast，cart 保持不变，用户可重试
        })
        .finally(() => {
          this.submitting = false
        })
    },

    goBack() {
      this.$router.push('/today')
    },

    goMenu() {
      this.$router.push('/menu')
    }
  }
}
</script>

<style scoped>
.submit-page {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.state-box {
  padding: 60px 16px;
  text-align: center;
}
.section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.dish-list {
  margin-bottom: 14px;
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
.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #969799;
}
.submit-bar {
  margin-top: 20px;
}
.submit-bar .van-button {
  min-height: 44px;
  font-weight: 600;
}
</style>
