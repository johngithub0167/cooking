import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const STORAGE_KEY = 'cooking:cart:v1'

function readCart () {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch (error) {
    return []
  }
}

function persistCart (cart) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
}

const cart = {
  namespaced: true,
  state: () => ({
    items: readCart()
  }),
  getters: {
    items: state => state.items,
    totalQuantity: state => state.items.reduce((sum, item) => sum + item.quantity, 0),
    itemCount: state => state.items.length,
    quantityByDishId: state => dishId => {
      const item = state.items.find(entry => entry.dishId === dishId)
      return item ? item.quantity : 0
    }
  },
  mutations: {
    ADD_ITEM (state, dish) {
      const existing = state.items.find(item => item.dishId === dish.dishId)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + (dish.quantity || 1), 99)
      } else {
        state.items.push({
          dishId: dish.dishId,
          quantity: Math.min(Math.max(dish.quantity || 1, 1), 99),
          dish: dish.dish || null
        })
      }
      persistCart(state.items)
    },
    SET_QUANTITY (state, { dishId, quantity }) {
      const item = state.items.find(entry => entry.dishId === dishId)
      if (!item) return
      if (quantity <= 0) {
        state.items = state.items.filter(entry => entry.dishId !== dishId)
      } else {
        item.quantity = Math.min(quantity, 99)
      }
      persistCart(state.items)
    },
    REMOVE_ITEM (state, dishId) {
      state.items = state.items.filter(item => item.dishId !== dishId)
      persistCart(state.items)
    },
    CLEAR (state) {
      state.items = []
      persistCart(state.items)
    }
  },
  actions: {
    addItem ({ commit }, dish) {
      commit('ADD_ITEM', dish)
    },
    increase ({ commit, getters }, dishId) {
      commit('SET_QUANTITY', { dishId, quantity: getters.quantityByDishId(dishId) + 1 })
    },
    decrease ({ commit, getters }, dishId) {
      commit('SET_QUANTITY', { dishId, quantity: getters.quantityByDishId(dishId) - 1 })
    },
    removeItem ({ commit }, dishId) {
      commit('REMOVE_ITEM', dishId)
    },
    clear ({ commit }) {
      commit('CLEAR')
    }
  }
}

export default new Vuex.Store({
  modules: { cart }
})
