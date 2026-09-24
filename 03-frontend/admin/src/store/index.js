import Vue from 'vue'
import Vuex from 'vuex'
import { TOKEN_KEY } from '@/utils/request'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    token: window.localStorage.getItem(TOKEN_KEY) || '',
    username: ''
  },
  getters: {
    isAuthenticated: state => Boolean(state.token),
    username: state => state.username
  },
  mutations: {
    SET_TOKEN (state, token) {
      state.token = token || ''
      if (token) window.localStorage.setItem(TOKEN_KEY, token)
      else window.localStorage.removeItem(TOKEN_KEY)
    },
    SET_USERNAME (state, username) {
      state.username = username || ''
    }
  },
  actions: {
    setAuth ({ commit }, { token, username }) {
      commit('SET_TOKEN', token)
      commit('SET_USERNAME', username)
    },
    logout ({ commit }) {
      commit('SET_TOKEN', '')
      commit('SET_USERNAME', '')
    }
  }
})
