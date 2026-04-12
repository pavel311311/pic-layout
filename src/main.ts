import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setupNaiveUI } from './plugins/naive'
import './style.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
setupNaiveUI(app)
app.mount('#app')
