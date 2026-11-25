<template>
  <main class="page today-page">
    <van-nav-bar title="今日菜单" fixed placeholder />

    <section class="page__content">
      <!-- 空状态 -->
      <div v-if="itemCount === 0" class="state-box">
        <van-empty image="search" description="今日菜单还是空的" />
        <van-button type="primary" size="small" round @click="goMenu">去总菜单</van-button>
      </div>

      <template v-else>
        <!-- 统计 -->
        <div class="summary-bar">
          <span>共 {{ itemCount }} 道菜 / {{ totalQuantity }} 份</span>
          <van-button size="mini" type="danger" plain @click="onClear">清空</van-button>
        </div>

        <!-- 逐条菜品 -->
        <div v-for="item in items" :key="item.dishId" class="dish-row">
          <div class="dish-row__img">
            <img v-if="imageOf(item) && !imgFailed[item.dishId]" :src="imageOf(item)" alt="" @error="markImgFailed(item.dishId)">
            <div v-else class="dish-row__placeholder"><van-icon name="food-o" /></div>
          </div>
          <div class="dish-row__body">
            <p class="dish-row__name">{{ nameOf(item) }}</p>
            <p class="dish-row__qty">数量 × {{ item.quantity }}</p>
          </div>
          <div class="dish-row__action">
            <van-stepper
              :value="item.quantity"
              min="1"
              max="99"
              integer
              theme="round"
              button-size="28"
              @change="value => onStepperChange(item, value)"
            />
            <van-button size="mini" type="danger" plain class="remove-btn" @click="onRemove(item)">删除</van-button>
          </div>
        </div>
      </template>
    </section>

    <!-- 提交菜单入口（固定底部，Tabbar 之上） -->
    <div v-if="itemCount > 0" class="submit-bar">
      <van-button type="primary" block round @click="goSubmit">提交菜单</van-button>
    </div>
  </main>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  name: 'TodayMenu',
  data() {
    return {
      imgFailed: {}
    }
  },
  computed: {
    ...mapGetters('cart', ['items', 'itemCount', 'totalQuantity'])
  },
  methods: {
    ...mapActions('cart', ['increase', 'decrease', 'removeItem', 'clear']),

    nameOf(item) {
      return item.dish && item.dish.name ? item.dish.name : `菜品 #${item.dishId}`
    },

    imageOf(item) {
      // 无图片时用占位，避免请求 /uploads/null
      if (!item.dish) return ''
      return item.dish.thumbUrl || item.dish.coverUrl || ''
    },

    markImgFailed(id) {
      this.$set(this.imgFailed, id, true)
    },

    // stepper min=1：只会在 1~99 内变化，减到 1 不能再减；移除走删除按钮
    onStepperChange(item, value) {
      const target = Number(value)
      const current = Number(item.quantity)
      if (target > current) {
        this.increase(item.dishId)
      } else if (target < current) {
        this.decrease(item.dishId)
      }
    },

    onRemove(item) {
      this.$dialog.confirm({
        title: '删除菜品',
        message: `确定从今日菜单移除「${this.nameOf(item)}」吗？`
      }).then(() => {
        this.removeItem(item.dishId)
        this.$toast.success('已删除')
      }).catch(() => {
        // 取消删除
      })
    },

    onClear() {
      this.$dialog.confirm({
        title: '清空菜单',
        message: '确定清空今日菜单吗？此操作不可撤销。'
      }).then(() => {
        this.clear()
        this.$toast.success('已清空')
      }).catch(() => {
        // 取消清空
      })
    },

    goMenu() {
      this.$router.push('/menu')
    },

    goSubmit() {
      // 路由由 FE-015 实现，这里只负责跳转
      this.$router.push('/submit')
    }
  }
}
</script>

<style scoped>
.today-page {
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
}

.state-box {
  padding: 60px 16px;
  text-align: center;
}

.summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.dish-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
}
.dish-row__img {
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
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
  font-size: 28px;
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
.dish-row__action {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.remove-btn {
  min-height: 28px;
}

.submit-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(62px + env(safe-area-inset-bottom));
  z-index: 10;
}
.submit-bar .van-button {
  min-height: 44px;
  font-weight: 600;
}
</style>
