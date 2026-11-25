<template>
  <main class="page menu-page">
    <van-nav-bar title="总菜单" fixed placeholder />

    <!-- 搜索 -->
    <van-search
      v-model="keywordInput"
      placeholder="搜索菜名或食材"
      shape="round"
      background="#f7f8fa"
      @input="onSearchInput"
      @clear="onSearchClear"
    />

    <!-- 分类筛选 -->
    <div class="category-bar">
      <button
        class="category-chip"
        :class="{ active: activeCategory === 0 }"
        @click="onCategoryChange(0)"
      >全部</button>
      <button
        v-for="c in categories"
        :key="c.id"
        class="category-chip"
        :class="{ active: activeCategory === c.id }"
        @click="onCategoryChange(c.id)"
      >{{ c.name }}</button>
    </div>

    <!-- 加载失败：提示 + 重试 -->
    <div v-if="loadError" class="state-box">
      <van-empty image="error" description="菜品加载失败" />
      <van-button type="primary" size="small" @click="reload">重新加载</van-button>
    </div>

    <!-- 下拉刷新 + 上拉加载 -->
    <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model="loading"
        :finished="finished"
        finished-text="没有更多了"
        :error="listError"
        error-text="加载失败，点击重试"
        @load="onLoad"
        @error="onLoadError"
      >
        <div v-if="showEmpty" class="state-box">
          <van-empty image="search" description="没有找到相关菜品" />
        </div>

        <div v-for="dish in list" :key="dish.id" class="dish-card">
          <div class="dish-card__img">
            <img v-if="imageOf(dish) && !imgFailed[dish.id]" :src="imageOf(dish)" alt="" @error="markImgFailed(dish.id)">
            <div v-else class="dish-card__placeholder"><van-icon name="food-o" /></div>
          </div>
          <div class="dish-card__body">
            <div class="dish-card__title">
              <span class="dish-name">{{ dish.name }}</span>
              <van-tag v-if="dish.categoryName" plain type="primary" size="mini">{{ dish.categoryName }}</van-tag>
            </div>
            <p v-if="dish.description" class="dish-desc">{{ dish.description }}</p>
            <div class="dish-meta">
              <van-tag v-if="spicyText(dish.spicyLevel)" :type="spicyTagType(dish.spicyLevel)" size="mini">{{ spicyText(dish.spicyLevel) }}</van-tag>
              <span v-if="dish.cookMinutes">{{ dish.cookMinutes }} 分钟</span>
            </div>
          </div>
          <div class="dish-card__action">
            <van-button
              v-if="quantityOf(dish.id) === 0"
              type="primary"
              size="small"
              round
              class="add-btn"
              @click="addDish(dish)"
            >加入</van-button>
            <van-stepper
              v-else
              :value="quantityOf(dish.id)"
              min="0"
              max="99"
              integer
              theme="round"
              button-size="28"
              @change="value => onStepperChange(dish, value)"
            />
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 底部已选入口（固定在 Tabbar 上方） -->
    <div class="cart-bar" @click="goToday">
      <van-icon name="cart-o" class="cart-bar__icon" />
      <span>已选 {{ itemCount }} 项</span>
      <span class="cart-bar__arrow">查看今日菜单 <van-icon name="arrow" /></span>
    </div>
  </main>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { listCategories } from '@/api/categories'
import { listDishes } from '@/api/dishes'

const PAGE_SIZE = 20

export default {
  name: 'Menu',
  data() {
    return {
      categories: [],
      activeCategory: 0,
      keywordInput: '',
      keyword: '',
      searchTimer: null,
      list: [],
      page: 1,
      total: 0,
      loading: false,
      refreshing: false,
      finished: false,
      loadError: false,
      listError: false,
      imgFailed: {}
    }
  },
  computed: {
    ...mapGetters('cart', ['itemCount', 'quantityByDishId']),
    showEmpty() {
      return !this.loading && !this.refreshing && !this.loadError && !this.listError && this.list.length === 0
    }
  },
  created() {
    this.loadCategories()
  },
  beforeDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  methods: {
    ...mapActions('cart', ['addItem', 'increase', 'decrease']),

    quantityOf(id) {
      return this.quantityByDishId(id)
    },

    loadCategories() {
      listCategories()
        .then(data => { this.categories = Array.isArray(data) ? data : [] })
        .catch(() => { this.categories = [] })
    },

    // ---- 列表加载：首次 / 上拉 ----
    onLoad() {
      if (this.refreshing) {
        this.refreshing = false
      }
      this.fetchPage(this.page)
    },

    fetchPage(page) {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        categoryId: this.activeCategory || undefined,
        keyword: this.keyword || undefined
      }
      listDishes(params)
        .then(data => {
          const rows = Array.isArray(data.list) ? data.list : []
          this.list = page === 1 ? rows : this.list.concat(rows)
          this.total = Number(data.total) || 0
          // 指向下一页，供 van-list 上拉加载使用
          this.page = page + 1
          this.loadError = false
          this.listError = false
          // 已取满总数或本页无数据即结束，避免空页反复触发加载
          this.finished = rows.length === 0 || this.list.length >= this.total
        })
        .catch(() => {
          this.listError = true
          this.finished = true
        })
        .finally(() => {
          this.loading = false
          this.refreshing = false
        })
    },

    // van-list 的 error 事件（这里主要靠 fetchPage 内部处理）
    onLoadError() {
      this.listError = true
    },

    // ---- 下拉刷新 ----
    onRefresh() {
      this.resetAndLoad()
    },

    // ---- 重试 / 重置 ----
    reload() {
      this.loadError = false
      this.listError = false
      this.resetAndLoad()
    },

    resetAndLoad() {
      this.list = []
      this.page = 1
      this.total = 0
      this.finished = false
      this.listError = false
      this.loadError = false
      this.loading = true
      this.fetchPage(1)
    },

    // ---- 分类切换 ----
    onCategoryChange(id) {
      if (id === this.activeCategory) return
      this.activeCategory = id
      this.resetAndLoad()
    },

    // ---- 搜索 300ms 防抖 ----
    onSearchInput(value) {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.keyword = (value || '').trim()
        this.resetAndLoad()
      }, 300)
    },

    onSearchClear() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.keyword = ''
      this.resetAndLoad()
    },

    // ---- 购物车操作 ----
    addDish(dish) {
      this.addItem({
        dishId: dish.id,
        quantity: 1,
        dish: {
          id: dish.id,
          name: dish.name,
          coverUrl: dish.coverUrl || null,
          thumbUrl: dish.thumbUrl || null,
          categoryName: dish.categoryName || null
        }
      })
    },

    onStepperChange(dish, value) {
      const target = Number(value)
      const current = this.quantityOf(dish.id)
      if (target > current) {
        this.increase(dish.id)
      } else if (target < current) {
        this.decrease(dish.id)
      }
    },

    goToday() {
      this.$router.push('/today')
    },

    // ---- 展示辅助 ----
    imageOf(dish) {
      // 图片字段为 null 时用占位图，避免请求 /uploads/null
      return dish.thumbUrl || dish.coverUrl || ''
    },

    markImgFailed(id) {
      this.$set(this.imgFailed, id, true)
    },

    spicyText(level) {
      const map = { 0: '不辣', 1: '微辣', 2: '中辣', 3: '特辣' }
      return map[level] || ''
    },

    spicyTagType(level) {
      const map = { 0: 'default', 1: 'success', 2: 'warning', 3: 'danger' }
      return map[level] || 'default'
    }
  }
}
</script>

<style scoped>
.menu-page {
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
}

.category-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 16px;
  -webkit-overflow-scrolling: touch;
}
.category-chip {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #ebedf0;
  border-radius: 18px;
  background: #fff;
  color: #323233;
  font-size: 13px;
}
.category-chip.active {
  background: var(--brand-color);
  border-color: var(--brand-color);
  color: #fff;
}

.state-box {
  padding: 40px 16px;
  text-align: center;
}

.dish-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
}
.dish-card__img {
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
}
.dish-card__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.dish-card__placeholder {
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
.dish-card__body {
  flex: 1 1 auto;
  min-width: 0;
}
.dish-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dish-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dish-desc {
  margin: 4px 0;
  font-size: 12px;
  color: #969799;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dish-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #969799;
}
.dish-card__action {
  flex: 0 0 auto;
}
.add-btn {
  min-width: 64px;
  min-height: 44px;
}

.cart-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(62px + env(safe-area-inset-bottom));
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: 22px;
  background: #323233;
  color: #fff;
  font-size: 14px;
  z-index: 10;
}
.cart-bar__icon {
  font-size: 20px;
}
.cart-bar__arrow {
  margin-left: auto;
  font-size: 12px;
  color: #dcdee0;
}
</style>
