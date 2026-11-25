<template>
  <el-card class="categories-page">
    <div slot="header" class="page-header">
      <span>分类管理</span>
      <el-button type="primary" size="small" @click="openCreate">新增分类</el-button>
    </div>

    <!-- 加载失败：提示 + 重试 -->
    <div v-if="loadError" class="state-box">
      <i class="el-icon-warning-outline state-icon" />
      <p>分类加载失败，请稍后重试</p>
      <el-button size="small" type="primary" @click="loadList">重新加载</el-button>
    </div>

    <!-- 正常列表（含加载中与空状态） -->
    <el-table
      v-else
      :data="list"
      v-loading="loading"
      element-loading-text="加载中..."
      border
      stripe
      size="small"
      empty-text="暂无分类，点击右上角「新增分类」添加"
    >
      <el-table-column prop="id" label="ID" width="80" align="center" />
      <el-table-column prop="name" label="分类名称" min-width="140" />
      <el-table-column prop="sort" label="排序" width="100" align="center" />
      <el-table-column label="状态" width="100" align="center">
        <template slot-scope="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'info'" size="mini">
            {{ scope.row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="170">
        <template slot-scope="scope">
          {{ formatTime(scope.row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center">
        <template slot-scope="scope">
          <el-button type="text" size="small" @click="openEdit(scope.row)">编辑</el-button>
          <el-button type="text" size="small" class="danger-text" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog
      :title="dialogMode === 'create' ? '新增分类' : '编辑分类'"
      :visible.sync="dialogVisible"
      width="440px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form
        ref="form"
        :model="form"
        :rules="rules"
        label-width="80px"
        size="small"
      >
        <el-form-item label="分类名称" prop="name">
          <el-input
            v-model.trim="form.name"
            maxlength="32"
            placeholder="请输入分类名称（不超过 32 字）"
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number
            v-model="form.sort"
            :min="0"
            :max="999999"
            :step="10"
            :disabled="submitting"
            controls-position="right"
          />
          <span class="form-tip">值越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
            :disabled="submitting"
          />
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
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '@/api/categories'

export default {
  name: 'Categories',
  data() {
    return {
      list: [],
      loading: false,
      loadError: false,
      dialogVisible: false,
      dialogMode: 'create',
      editingId: null,
      submitting: false,
      form: {
        name: '',
        sort: 100,
        status: 1
      },
      rules: {
        name: [
          { required: true, message: '请输入分类名称', trigger: 'blur' },
          { max: 32, message: '分类名称不超过 32 字', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.loadList()
  },
  methods: {
    // 列表：加载中 / 失败重试 / 成功 / 空状态由模板分支与 empty-text 覆盖
    loadList() {
      this.loading = true
      this.loadError = false
      listCategories()
        .then(data => {
          this.list = Array.isArray(data) ? data : []
        })
        .catch(() => {
          // request.js 已统一弹错误提示，这里只切换失败态供重试
          this.list = []
          this.loadError = true
        })
        .finally(() => {
          this.loading = false
        })
    },

    openCreate() {
      this.dialogMode = 'create'
      this.editingId = null
      this.dialogVisible = true
    },

    openEdit(row) {
      this.dialogMode = 'edit'
      this.editingId = row.id
      this.form = {
        name: row.name,
        sort: row.sort,
        status: row.status
      }
      this.dialogVisible = true
    },

    resetForm() {
      this.dialogMode = 'create'
      this.editingId = null
      this.submitting = false
      this.form = { name: '', sort: 100, status: 1 }
      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.clearValidate()
      })
    },

    submitForm() {
      if (this.submitting) return
      this.$refs.form.validate(valid => {
        if (!valid) return
        this.submitting = true
        const payload = {
          name: this.form.name,
          sort: this.form.sort,
          status: this.form.status
        }
        const request$ = this.dialogMode === 'create'
          ? createCategory(payload)
          : updateCategory(this.editingId, payload)

        request$
          .then(() => {
            this.$message.success(this.dialogMode === 'create' ? '新增成功' : '保存成功')
            this.dialogVisible = false
            this.loadList()
          })
          .catch(() => {
            // 名称重复等错误由 request.js 统一提示，保持弹窗打开供修改
          })
          .finally(() => {
            this.submitting = false
          })
      })
    },

    handleDelete(row) {
      this.$confirm(
        `确定删除分类「${row.name}」吗？删除后该分类下的菜品将变为未分类。`,
        '删除确认',
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        return deleteCategory(row.id)
      }).then(data => {
        const affected = data && Number(data.affectedDishes) > 0 ? Number(data.affectedDishes) : 0
        this.$message.success(
          affected > 0
            ? `删除成功，${affected} 个菜品已变为未分类`
            : '删除成功'
        )
        this.loadList()
      }).catch(() => {
        // 取消删除或请求失败：请求失败已由 request.js 提示，这里不重复
      })
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
.categories-page >>> .el-card__header {
  padding: 12px 20px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.state-box {
  padding: 60px 0;
  text-align: center;
  color: #909399;
}
.state-icon {
  font-size: 40px;
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
