<template>
  <el-card class="dishes-page">
    <div slot="header" class="page-header">
      <span>菜品管理</span>
      <el-button type="primary" size="small" @click="openCreate">新增菜品</el-button>
    </div>

    <!-- 筛选区 -->
    <el-form :inline="true" size="small" class="filter-bar">
      <el-form-item label="分类">
        <el-select v-model="filters.categoryId" clearable placeholder="全部分类" style="width:140px" @change="handleFilterChange">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" clearable placeholder="全部状态" style="width:120px" @change="handleFilterChange">
          <el-option label="上架" :value="1" />
          <el-option label="下架" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="keywordInput"
          clearable
          placeholder="菜名或食材名"
          style="width:180px"
          @input="handleKeywordInput"
          @clear="handleFilterChange"
        />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="filters.includeDeleted" @change="handleFilterChange">含已删除</el-checkbox>
      </el-form-item>
    </el-form>

    <!-- 加载失败：提示 + 重试 -->
    <div v-if="loadError" class="state-box">
      <i class="el-icon-warning-outline state-icon" />
      <p>菜品加载失败，请稍后重试</p>
      <el-button size="small" type="primary" @click="loadList">重新加载</el-button>
    </div>

    <template v-else>
      <!-- 列表：加载中 / 空状态 / 正常 -->
      <el-table
        :data="list"
        v-loading="loading"
        element-loading-text="加载中..."
        border
        stripe
        size="small"
        empty-text="暂无菜品，点击右上角「新增菜品」添加"
      >
        <el-table-column label="图" width="72" align="center">
          <template slot-scope="scope">
            <img v-if="thumbOf(scope.row) && !imgFailed[scope.row.id]" :src="thumbOf(scope.row)" class="dish-thumb" @error="markImgFailed(scope.row.id)">
            <div v-else class="dish-thumb placeholder"><i class="el-icon-picture-outline" /></div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="菜名" min-width="130" />
        <el-table-column label="分类" width="100">
          <template slot-scope="scope">{{ scope.row.categoryName || '未分类' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'info'" size="mini">
              {{ scope.row.status === 1 ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" align="center" />
        <el-table-column label="更新时间" min-width="150">
          <template slot-scope="scope">{{ formatTime(scope.row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" align="center">
          <template slot-scope="scope">
            <el-switch
              :value="scope.row.status === 1"
              :disabled="!!scope.row.deletedAt"
              active-color="#13ce66"
              inactive-color="#dcdfe6"
              @change="val => handleStatusChange(scope.row, val)"
            />
            <el-button type="text" size="small" @click="openEdit(scope.row)">编辑</el-button>
            <el-button type="text" size="small" class="danger-text" :disabled="!!scope.row.deletedAt" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-bar">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </template>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog
      :title="dialogMode === 'create' ? '新增菜品' : '编辑菜品'"
      :visible.sync="dialogVisible"
      width="720px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="form" :model="form" :rules="rules" label-width="90px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="菜名" prop="name">
              <el-input v-model.trim="form.name" maxlength="64" placeholder="请输入菜名（≤64 字）" :disabled="submitting" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="categoryId">
              <el-select v-model="form.categoryId" clearable placeholder="未分类" style="width:100%" :disabled="submitting">
                <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主图 URL" prop="coverUrl">
              <el-input v-model.trim="form.coverUrl" placeholder="/uploads/...（AD-015 上传）" :disabled="submitting" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="缩略图 URL" prop="thumbUrl">
              <el-input v-model.trim="form.thumbUrl" placeholder="留空则回退主图" :disabled="submitting" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="辣度" prop="spicyLevel">
              <el-select v-model="form.spicyLevel" clearable placeholder="选填" style="width:100%" :disabled="submitting">
                <el-option label="不辣" :value="0" />
                <el-option label="微辣" :value="1" />
                <el-option label="中辣" :value="2" />
                <el-option label="特辣" :value="3" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="烹饪(分)" prop="cookMinutes">
              <el-input-number v-model="form.cookMinutes" :min="0" :max="9999" :disabled="submitting" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序" prop="sort">
              <el-input-number v-model="form.sort" :min="0" :max="999999" :disabled="submitting" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status" :disabled="submitting">
            <el-radio :label="1">上架</el-radio>
            <el-radio :label="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" placeholder="选填，一句话描述" :disabled="submitting" />
        </el-form-item>

        <!-- 食材：联想选择 + 手输新名 -->
        <el-form-item label="食材">
          <div class="ingredient-rows">
            <div v-for="(ing, idx) in form.ingredients" :key="idx" class="ingredient-row">
              <el-select
                v-model="ing.name"
                filterable
                allow-create
                remote
                reserve-keyword
                :remote-method="queryIngredients"
                :loading="ingredientLoading"
                placeholder="输入联想或手输新食材"
                style="width:220px"
                :disabled="submitting"
              >
                <el-option v-for="opt in ingredientOptions" :key="opt.id" :label="opt.name" :value="opt.name" />
              </el-select>
              <el-input v-model="ing.amountNote" placeholder="用量，如 2 个" style="width:140px" :disabled="submitting" />
              <el-button type="text" icon="el-icon-delete" class="danger-text" :disabled="submitting" @click="removeIngredient(idx)" />
            </div>
            <el-button size="small" icon="el-icon-plus" :disabled="submitting" @click="addIngredient">添加食材</el-button>
            <span class="form-tip">可选已有食材，也可直接输入新名称（后端自动创建）</span>
          </div>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="small" :loading="submitting" :disabled="submitting" @click="submitForm">
          {{ submitting ? '保存中...' : '确定' }}
        </el-button>
      </div>
    </el-dialog>
  </el-card>
</template>

<script>
import {
  listDishes,
  getDish,
  createDish,
  updateDish,
  deleteDish,
  updateDishStatus,
  searchIngredients
} from '@/api/dishes'
import { listCategories } from '@/api/categories'

function defaultForm() {
  return {
    name: '',
    categoryId: null,
    coverUrl: '',
    thumbUrl: '',
    description: '',
    spicyLevel: null,
    cookMinutes: null,
    status: 1,
    sort: 100,
    ingredients: []
  }
}

export default {
  name: 'Dishes',
  data() {
    return {
      list: [],
      categories: [],
      loading: false,
      loadError: false,
      filters: {
        categoryId: null,
        status: null,
        includeDeleted: false
      },
      keywordInput: '',
      keyword: '',
      keywordTimer: null,
      pagination: { page: 1, pageSize: 20, total: 0 },
      imgFailed: {},
      dialogVisible: false,
      dialogMode: 'create',
      editingId: null,
      submitting: false,
      form: defaultForm(),
      rules: {
        name: [
          { required: true, message: '请输入菜名', trigger: 'blur' },
          { max: 64, message: '菜名不超过 64 字', trigger: 'blur' }
        ]
      },
      ingredientOptions: [],
      ingredientLoading: false
    }
  },
  created() {
    this.loadCategories()
    this.loadList()
  },
  beforeDestroy() {
    if (this.keywordTimer) clearTimeout(this.keywordTimer)
  },
  methods: {
    // ---- 列表四态：加载中 / 失败重试 / 空状态(empty-text) / 正常 ----
    loadList() {
      this.loading = true
      this.loadError = false
      const params = {
        page: this.pagination.page,
        pageSize: this.pagination.pageSize,
        categoryId: this.filters.categoryId || undefined,
        status: this.filters.status === null || this.filters.status === '' ? undefined : this.filters.status,
        keyword: this.keyword || undefined,
        includeDeleted: this.filters.includeDeleted ? 'true' : undefined
      }
      listDishes(params)
        .then(data => {
          this.list = Array.isArray(data.list) ? data.list : []
          this.pagination.total = Number(data.total) || 0
          this.pagination.page = Number(data.page) || this.pagination.page
          this.pagination.pageSize = Number(data.pageSize) || this.pagination.pageSize
        })
        .catch(() => {
          this.list = []
          this.pagination.total = 0
          this.loadError = true
        })
        .finally(() => {
          this.loading = false
        })
    },

    loadCategories() {
      listCategories()
        .then(data => { this.categories = Array.isArray(data) ? data : [] })
        .catch(() => { this.categories = [] })
    },

    handleFilterChange() {
      this.pagination.page = 1
      this.loadList()
    },

    // 搜索 300ms 防抖
    handleKeywordInput(value) {
      if (this.keywordTimer) clearTimeout(this.keywordTimer)
      this.keywordTimer = setTimeout(() => {
        this.keyword = (value || '').trim()
        this.handleFilterChange()
      }, 300)
    },

    handlePageChange(page) {
      this.pagination.page = page
      this.loadList()
    },

    handleSizeChange(size) {
      this.pagination.pageSize = size
      this.pagination.page = 1
      this.loadList()
    },

    // ---- 上下架：一键切换 ----
    handleStatusChange(row, value) {
      const status = value ? 1 : 0
      updateDishStatus(row.id, status)
        .then(() => {
          row.status = status
          this.$message.success(status === 1 ? '已上架' : '已下架')
        })
        .catch(() => {
          // 请求失败由 request.js 统一提示，回滚开关由重新渲染列表完成
          this.loadList()
        })
    },

    // ---- 删除：二次确认 + 逻辑删除 ----
    handleDelete(row) {
      this.$confirm(`确定删除菜品「${row.name}」吗？删除后将不再出现在列表中。`, '删除确认', {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        return deleteDish(row.id)
      }).then(() => {
        this.$message.success('删除成功')
        this.loadList()
      }).catch(() => {
        // 取消或失败：失败已由 request.js 提示
      })
    },

    // ---- 新增 / 编辑弹窗 ----
    openCreate() {
      this.dialogMode = 'create'
      this.editingId = null
      this.form = defaultForm()
      this.ingredientOptions = []
      this.dialogVisible = true
    },

    openEdit(row) {
      this.dialogMode = 'edit'
      this.editingId = row.id
      this.submitting = true
      getDish(row.id)
        .then(data => {
          this.form = {
            name: data.name || '',
            categoryId: data.categoryId || null,
            coverUrl: data.coverUrl || '',
            thumbUrl: data.thumbUrl || '',
            description: data.description || '',
            spicyLevel: data.spicyLevel === null || data.spicyLevel === undefined ? null : data.spicyLevel,
            cookMinutes: data.cookMinutes === null || data.cookMinutes === undefined ? null : data.cookMinutes,
            status: data.status === undefined ? 1 : data.status,
            sort: data.sort === undefined ? 100 : data.sort,
            ingredients: Array.isArray(data.ingredients)
              ? data.ingredients.map(i => ({ name: i.name, amountNote: i.amountNote || '' }))
              : []
          }
          this.ingredientOptions = this.form.ingredients.map(i => ({ id: i.name, name: i.name }))
          this.dialogVisible = true
        })
        .catch(() => {})
        .finally(() => { this.submitting = false })
    },

    resetForm() {
      this.dialogMode = 'create'
      this.editingId = null
      this.submitting = false
      this.form = defaultForm()
      this.ingredientOptions = []
      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.clearValidate()
      })
    },

    submitForm() {
      if (this.submitting) return
      this.$refs.form.validate(valid => {
        if (!valid) return
        this.submitting = true
        // 全量覆盖：所有字段都提交；食材过滤空 name 映射成 [{ name, amountNote }]
        const payload = {
          name: this.form.name,
          categoryId: this.form.categoryId || null,
          coverUrl: this.form.coverUrl || null,
          thumbUrl: this.form.thumbUrl || null,
          description: this.form.description || null,
          spicyLevel: this.form.spicyLevel === '' ? null : this.form.spicyLevel,
          cookMinutes: this.form.cookMinutes === '' ? null : this.form.cookMinutes,
          status: this.form.status,
          sort: this.form.sort,
          ingredients: (this.form.ingredients || [])
            .filter(i => i && i.name)
            .map(i => ({ name: i.name, amountNote: i.amountNote || null }))
        }
        const request$ = this.dialogMode === 'create'
          ? createDish(payload)
          : updateDish(this.editingId, payload)
        request$
          .then(() => {
            this.$message.success(this.dialogMode === 'create' ? '新增成功' : '保存成功')
            this.dialogVisible = false
            this.loadList()
          })
          .catch(() => {
            // 错误由 request.js 统一提示，保持弹窗打开供修改
          })
          .finally(() => { this.submitting = false })
      })
    },

    // ---- 食材行 ----
    addIngredient() {
      this.form.ingredients.push({ name: '', amountNote: '' })
    },

    removeIngredient(idx) {
      this.form.ingredients.splice(idx, 1)
    },

    queryIngredients(keyword) {
      if (!keyword) {
        this.ingredientOptions = []
        return
      }
      searchIngredients(keyword)
        .then(data => { this.ingredientOptions = Array.isArray(data) ? data : [] })
        .catch(() => { this.ingredientOptions = [] })
    },

    // ---- 展示辅助 ----
    thumbOf(row) {
      return row.thumbUrl || row.coverUrl || ''
    },

    markImgFailed(id) {
      // 图片加载失败：标记后由模板切换为占位块（用 $set 保证响应式）
      this.$set(this.imgFailed, id, true)
    },

    formatTime(value) {
      if (!value) return '-'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return value
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.dishes-page >>> .el-card__header {
  padding: 12px 20px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.filter-bar {
  margin-bottom: 12px;
}
.state-box {
  padding: 60px 0;
  text-align: center;
  color: #909399;
}
.state-icon {
  font-size: 40px;
}
.dish-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  display: inline-block;
}
.dish-thumb.placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 22px;
}
.pagination-bar {
  margin-top: 16px;
  text-align: right;
}
.ingredient-rows .ingredient-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.form-tip {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.danger-text {
  color: #f56c6c;
}
</style>
