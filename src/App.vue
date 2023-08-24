<script setup>
import axios from 'axios';
import { ref, onMounted, reactive, toRefs, provide, watch, nextTick, onUnmounted } from 'vue';
import { Delete, Lock, ArrowLeft, ArrowRight, DocumentAdd, Setting, Edit, CopyDocument, Check, CaretBottom, ChromeFilled, Refresh, CloseBold, Close, Switch, Hide } from '@element-plus/icons-vue'
import { ipcRenderer, clipboard } from "electron"
const { getCurrentWindow } = require('@electron/remote');
import Markdown from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';
import { ElMessage } from 'element-plus';
import pinyin from "pinyin";
import GeneralConfig from './components/GeneralConfig.vue';
import AboutThis from './components/AboutThis.vue';
import CreateBase from './components/CreateBase.vue';
import UpdateBase from './components/UpdateBase.vue';
import WebChat from './components/WebChat.vue';
import WebChat2 from './components/WebChat2.vue';
import WebChat3 from './components/WebChat3.vue';
import 'element-plus/theme-chalk/dark/css-vars.css'
import markdownItCopy from 'markdown-it-code-copy';
import MarkdownItTaskLists from 'markdown-it-task-lists';


const md = Markdown({
  highlight: (str, lang) => {
    const code = lang && hljs.getLanguage(lang)
      ? hljs.highlight(str, {
        language: lang,
        ignoreIllegals: true,
      }).value
      : md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${code}</code></pre>`;
  },
}).use(MarkdownItTaskLists).use(markdownItCopy, { iconClass: 'code-copy-button', iconStyle: 'font-size: 12px; opacity: 0.8', buttonStyle: 'position: absolute; top: 6px; right: 0px; cursor: pointer; outline: none; background: transparent;border: none; color: white' });

const md2html = () => {
  for (let i = 0; i < QAcontext.value.length; i++) {
    let qa = QAcontext.value[i][1]
    let frontSlots = qa.match(/<frontslot>(.*?)<\/frontslot>/gs)
    let rearSlots = qa.match(/<rearslot>(.*?)<\/rearslot>/gs)
    let frontSlotTags = []
    let rearSlotTags = []
    if (frontSlots) {
      for (let j = 0; j < frontSlots.length; j++) {
        let frontSlot = frontSlots[j].replace(/<frontslot>|<\/frontslot>/g, '')
        frontSlotTags.push(`<div>${frontSlot}</div>`)
        qa = qa.replace(/<frontslot>(.*?)<\/frontslot>/s, '')
      }
    }
    if (rearSlots) {
      for (let j = 0; j < rearSlots.length; j++) {
        let rearSlot = rearSlots[j].replace(/<rearslot>|<\/rearslot>/g, '')
        rearSlotTags.push(`<div>${rearSlot}</div>`)
        qa = qa.replace(/<rearslot>(.*?)<\/rearslot>/s, '')
      }
    }
    qa = md.render(qa)
    if (frontSlotTags.length > 0) {
      qa = `<br>${frontSlotTags.join('')}${qa}`
    }
    if (rearSlotTags.length > 0) {
      qa = `${qa}${rearSlotTags.join('')}<br>`
    }
    QAcontext.value[i][1] = qa
  }
}

let QAcontext = ref([]); // 所有的问答对历史
let scrollbarRef = ref(null); // 滚动条的ref，控制滚动
let inputText = ref('')  // 主输入框的内容
let tagBoxRef = ref(null)  // 标签框的ref，用于控制高度
const drawer = ref(false)
const webDrawer = ref(false)
const activeSettingTab = ref('normal')
const activeWebTab = ref('chatgpt-web')
const hideAfter = ref(0)
let currentWindow = getCurrentWindow();
let isLock = !currentWindow.isResizable() // 是否锁定窗口
let winOffset = 0 // 窗口偏移量，用于微调一些组件的位置
let isMac = process.platform === 'darwin' ? true : false // 判断当前的操作系统，如果是windows则设置为false，否则设置为true
if (isLock) {
  winOffset = 30
}


if (!isLock) {
  QAcontext.value = [['正在启动……', '']];
  if (!isMac) {
    winOffset = -30
  }
}

// let defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset -40


let defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset // 默认的聊天显示框高度
let bodyHeight = ref(`${defaultBodyHeight}px`)
let retryCount = 0; // 当前已重试的次数


const adjustHeight = () => {
  let tagHeight = 0
  if (tagBoxRef.value || tagBoxRef.value.getBoundingClientRect().height != 0) {
    tagHeight = tagBoxRef.value.getBoundingClientRect().height - 20
  }
  // defaultBodyHeight = currentWindow.getSize()[1] - parseInt((currentWindow.getSize()[1] + 1700) / 12) + winOffset - 40
  defaultBodyHeight = currentWindow.getSize()[1] - 180 + winOffset - tagHeight
  bodyHeight.value = `${defaultBodyHeight}px`
}

let intervalId = null // 流式请求的定时器id
let pageInfo = ref(null) // 页码信息
let streaming = ref(false) // 是否正在流式请求
let connected = ref(false) // 是否连接braindoor
let isLoading = ref(true) // 是否正在加载，控制是否可以输入和使用工具按钮
let isInputFocus = ref(null)
let cancelToken = null
const tagColor = { // 根据etag的类型设定标签颜色,单词只是区分颜色，不是实际意义
  base: 'warning',
  prompt: 'primary',
  snippet: 'primary',
  engine: 'success',
  webchat:'success',
  agent: 'danger',
  model: 'info',
}
let tagList = ref([])
let tagListCache = []
let snippetCache = []
let caretPosition = { left: 0, top: 0 };
let listRef = ref(null)
let inputRef = ref(null)
let showList = ref(false)
let inputTags = ref([])
let tagQuery = ""
let reviewMode = false
let placeholderText = ref('请输入内容');
let showHistory = ref(false)
let historyRef = ref(null)
let queryResult = ref([]) // 历史记录查结果
let query = ref(null) // 历史记录查询词
let followMode = ref(false)
const hoverNewPage = ref(false)
const historyLoading = ref(false)
const WebChatRef1 = ref(null)
const WebChatRef2 = ref(null)
let zoomed = false

// 从localstorage中读取keepTag的值, 默认true,用于是否在提交后是否删除标签
let keepTag = ref(localStorage.getItem('keepTag') === 'false' ? false : true)
watch(keepTag, (newVal) => {
  localStorage.setItem('keepTag', newVal)
})
provide('keepTag', keepTag)



// 设置主题
let theme = ref(localStorage.getItem('theme') || 'dark')
let themeHTML = ref('dark')
const updateTheme = async () => {
  if (theme.value === 'dark') {
    themeHTML.value = 'dark'
  } else if (theme.value === 'light') {
    themeHTML.value = 'light';
  } else if (theme.value === 'auto') {
    themeHTML.value = await getSystemTheme();
  }
  if (themeHTML.value === 'dark') {
    document.body.style.backgroundColor = "black";
  } else {
    document.body.style.backgroundColor = "#E5EAF3";
  }
  if (isLock) {
    document.body.style.backgroundColor = "unset";
  }
}
watch(theme, async (newVal) => {
  localStorage.setItem('theme', newVal)
  updateTheme()
})
provide('theme', theme)

// watch streaming值的改变，改变后发送到主进程
watch(streaming, (newVal) => {
  ipcRenderer.send("streaming", newVal);
})


currentWindow.on('resize', () => {
  adjustHeight();
})

// 提交text，发送请求到braindoor
const sendRequests = (startIndex = 9999) => {
  // 发送总请求
  let question = inputText.value
  if (question) {
    streaming.value = true
    cancelToken = axios.CancelToken.source()
    const tagStr = tag2str(question)
    question = question + tagStr
    const placeholder = placeholderText.value
    placeholderText.value = '正在思考……'

    axios.post('http://127.0.0.1:7860/run/ask', {
      data: [question, "", "", "default", "", "", "brainshell", "", startIndex]
    }).then(response => {
      clearInterval(intervalId); // 停止流式请求
      streaming.value = false
      inputRef.value.focus()
      setTimeout(() => {
        QAcontext.value = response['data']['data'][0]
        pageInfo.value = response['data']['data'][5]
        placeholderText.value = placeholder
        md2html()
        scrollEnd();
        nextTick(() => {
          addCodeCopy()
        })
      }, 100);
    }).catch(error => {
      console.error(error);
      placeholderText.value = placeholder
    });
    // 发送流式结果请求
    intervalId = setInterval(() => {
      axios.post('http://127.0.0.1:7860/run/get_ask_stream_answer', {
        data: [question, [], startIndex]
      }).then(response => {
        QAcontext.value = response['data']['data'][0] // 数组，包含了所有历史记录
        md2html();
        scrollEnd();
      }).catch(error => {
        console.error(error);
      });
    }, 100);
    inputText.value = "";
    adjustHeight();
    if (!keepTag.value) {
      inputTags.value = []
    }


  } else {
    ElMessage({
      message: '没输入内容啊',
      type: 'warning',
    })
  }
}

// 滚动到底部
const scrollEnd = () => {
  setTimeout(() => {
    scrollbarRef.value.setScrollTop(999999)
  }, 50)
}

// 新建页面
const newPage = () => {
  axios.post('http://127.0.0.1:7860/run/new_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][7]
    QAcontext.value = ""
    placeholderText.value = '请输入内容'
    state.editable = state.editable.map(() => false)
    showHistory.value = false
  }).catch(error => {
    console.error(error);
  });
  clearInterval(intervalId);
  QAcontext.value = ""
  if (!keepTag.value) {
    inputTags.value = []
  }
}

// 按下下一页按钮时，获取下一页的内容
const nextPage = () => {
  axios.post('http://127.0.0.1:7860/run/next_page', {
    data: ["", "", "", 0]
  }).then((response) => {
    pageInfo.value = response['data']['data'][5]
    QAcontext.value = response['data']['data'][0]
    reviewMode = response['data']['data'][9]
    state.editable = state.editable.map(() => false)

    if (reviewMode) {
      placeholderText.value = '目前是全文阅读模式，你可以针对上传的文档提问'
    } else {
      placeholderText.value = '请输入内容'
    }
    md2html()
    nextTick(() => {
      addCodeCopy()
    })
    // scrollEnd()
  }).catch(error => {
    console.error(error);
  });
}

// 按下前一页按钮时，获取上一页的内容
const prevPage = () => {
  axios.post('http://127.0.0.1:7860/run/prev_page', {
    data: ["", "", "", 0]
  }).then((response) => {
    pageInfo.value = response['data']['data'][5]
    QAcontext.value = response['data']['data'][0]
    reviewMode = response['data']['data'][9]
    state.editable = state.editable.map(() => false)
    if (reviewMode) {
      placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    } else {
      placeholderText.value = '请输入内容'
    }
    md2html()
    nextTick(() => {
      addCodeCopy()
    })
  }).catch(error => {
    console.error(error);
  });
}

const jumpPage = (pageName) => {
  axios.post('http://127.0.0.1:7860/run/prev_page', {
    data: ["", "", "", pageName]
  }).then((response) => {
    pageInfo.value = response['data']['data'][5]
    QAcontext.value = response['data']['data'][0]
    reviewMode = response['data']['data'][9]
    state.editable = state.editable.map(() => false)
    if (reviewMode) {
      placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    } else {
      placeholderText.value = '请输入内容'
    }
    md2html()
    nextTick(() => {
      addCodeCopy()
    })
  }).catch(error => {
    console.error(error);
  });
}



// 删除当前对话页面
const delPage = () => {
  axios.post('http://127.0.0.1:7860/run/del_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][6]
    QAcontext.value = response['data']['data'][0]
    reviewMode = response['data']['data'][9]
    state.editable = state.editable.map(() => false)
    // showHistory.value = false
    if (reviewMode) {
      placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    } else {
      placeholderText.value = '请输入内容'
    }
    md2html()
    nextTick(() => {
      addCodeCopy()
    })
  }).catch(error => {
    console.error(error);
  });
  if (!keepTag.value) {
    inputTags.value = []
  }
}

// 强行中断请求
const stopRequest = () => {
  axios.post('http://127.0.0.1:7860/run/stop', {
    data: []
  }).then(() => {
    scrollEnd()
    placeholderText.value = '中断了，可重新输入'
  }).catch(error => {
    console.error(error);
    placeholderText.value = '中断了，可重新输入'
  });
  clearInterval(intervalId);
  if (cancelToken) {
    cancelToken.cancel('请求已取消')
    streaming.value = false
  }
}

// lock模式切换，向主进程发送消息，主进程收到消息后重载窗口
const lock = () => {
  if (isLock) {
    isLock = false;
  }
  else {
    isLock = true;
  }
  ipcRenderer.send("render2main", "reloadWindow");
}

// 用于控制输入框自动透明
let transparentTimeout = null;
const inputAreaFocus = () => {
  const inputArea = document.querySelector('#inputArea');
  inputArea.style.backgroundColor = 'var(--el-bg-inputarea)';
  clearTimeout(transparentTimeout);
}


// 用于控制输入框透明
const inputAreaBlur = debounce(() => {
  if (QAcontext.value.length === 0 && isLock && inputText.value === '') {
    transparentTimeout = setTimeout(() => {
      if (QAcontext.value.length === 0 && isLock && inputText.value === '') {
        const inputArea = document.querySelector('#inputArea');
        inputArea.style.backgroundColor = 'unset';
      }
    }, 5000);
  }
}, 500)

const textAreaFocus = () => {
  isInputFocus.value = true
  showHistory.value = false
}

const textAreaBlur = () => {
  isInputFocus.value = false
}

const toolbarOnHover = () => {
  isLoading.value = false
}

const toolbarOnLeave = () => {
  isLoading.value = true
}

// 获取snippet的请求
function getSnippets() {
  ipcRenderer.send('request-snippets');
  return new Promise((resolve, reject) => {
    ipcRenderer.once('reply-snippets', (event, response) => {
      if (response.status === 'success') {
        resolve(response.data);
      } else if (response.status === 'error') {
        reject(new Error(response.message));
      }
    });
  });
}

// 启动后尝试与braindoor进行连接
const contactBrainoor = () => {
  axios.post('http://127.0.0.1:7860/run/new_page', {
    data: []
  }).then((response) => {
    pageInfo.value = response['data']['data'][7]
    const arr = response['data']['data'][8]['data']
    // tagList.value = arr.map(([name, type]) => ({ name, type }));
    connected.value = true;


    tagList.value = [...tagList.value, ...arr.map(([name, type]) => ({ name, type }))];

    tagList.value = tagList.value.map(item => {
      return {
        ...item, color: tagColor[item.type], abbr: textAbbr(item.name) + item.type
      }
    })

    // 获取snippet
    getSnippets().then(snippets => {
      tagList.value = [...tagList.value, ...snippets.map(({ name }) => ({
        name,
        type: 'snippet',
        color: tagColor['snippet'],
        abbr: textAbbr(name) + 'snippet'
      }))];
      tagListCache = tagList.value.slice();
      snippetCache = snippets.slice();
    }).catch(error => {
      console.error(error);
      tagListCache = tagList.value.slice();
    });

    if (!isLock) {
      QAcontext.value = [['正在启动……', '#### OpenCopilot启动成功，可以对话了  \n- 换行：`Shift-Enter`  \n- 功能标签：`/`  \n- 新建对话：`Cmd/Ctrl + T`  \n- 查询历史：`Cmd/Ctrl + F`  \n- 全局Chat：`Option/Alt + L (默认)`  \n- <rearslot><br>&nbsp;首次使用需要&nbsp;<a href="#" onClick="testFn()">设置OpenAI Key</a><br>&nbsp;更多 <a href="https://opencopilot.rtfd.io">帮助</a></rearslot>']];
      md2html();
      // clearInterval(retryId);

    }

  }).catch(error => {
    console.error(`连接braindoor错误： ${error.message}`);
    retry();
  });

}

// 用于添加webchat标签
function addWebChatTag(){
  const tags = ["ChatGPT-Web","Claude-Web","Bing-Web"]
  tags.forEach(tag => {
    tagList.value.push({
      name: tag,
      type: 'webchat',
      color: tagColor['webchat'],
      abbr: textAbbr(tag) + 'webchat'
    })
  })
}

// 重试函数,用于contactBrainoor失败时重试
const retry = () => {
  retryCount++;
  console.log(`正在进行第 ${retryCount} 次重试`);
  if (retryCount === 60) {
    console.error('无法连接braindoor，打开127.0.0.1:7860查看配置是否正确');
    // clearInterval(retryId);
    return;
  }
  // 按照设定的间隔再次发送请求
  // retryId = setInterval(contactBrainoor, 3000);
  setTimeout(() => {
    contactBrainoor();
  }, 3000)
}

// 储存窗口状态
function setState() {
  let rect = currentWindow.getBounds();
  let obj = { rect }
  localStorage.setItem('winState', JSON.stringify(obj));
}

// 获得储存的窗口状态
function getState() {
  let winState = localStorage.getItem('winState');
  winState = JSON.parse(winState);
  currentWindow.setBounds(winState.rect);
}

// 防抖函数
function debounce(fn) {
  let timeout = null;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn.apply(this, arguments);
    }, 500);
  }
}

const handleInput = () => {
  // console.log(tagBoxRef.value.getBoundingClientRect().height)
}

// 删除已经选择的etag
const handleTagClose = (tag) => {
  inputTags.value.splice(inputTags.value.indexOf(tag), 1)
  setTimeout(() => {
    adjustHeight()
  }, 50)
}

// 生成tag字符串,加入到输入框中，发送给braindoor
function tag2str(question) {
  if (inputTags.value.length > 0) {
    let tagStrings = inputTags.value.map(tag => '#' + tag.name);

    // 如果question中有tagStrings中相同的tag,则把该tag从tagStrings中删除
    tagStrings = tagStrings.filter(tag => {
      return question.indexOf(tag) === -1
    })

    // 如果tagStrings中有#File,也把它从tagStrings中删除
    tagStrings = tagStrings.filter(tag => {
      return tag !== '#File'
    })

    let result = tagStrings.join(' ');
    if (result !== '') {
      result = "\n " + result
    }

    return result;
  } else {
    return ''
  }
}


// 选择etag列表中的条目
function selectItem(item) {
  const textarea = inputRef.value.textarea
  const position = inputRef.value.textarea.selectionEnd

  // 如果是webchat, 直接执行命令
  if (item.type=="webchat"){
    ipcRenderer.send("clickMinimize", "only-restore");
    if (item.name === "ChatGPT-Web"){
      webDrawer.value = true;
      activeWebTab.value = "chatgpt-web"
    }
    if (item.name === "Claude-Web"){
      webDrawer.value = true;
      activeWebTab.value = "claude-web"
    }
    const text = textarea.value;
    const queryLength = tagQuery.length + 1;
    textarea.value = text.substring(0, position - queryLength) + text.substring(position);
    inputText.value = textarea.value;
    textarea.selectionStart = position - queryLength;
    textarea.selectionEnd = position - queryLength;
    return;
  }
  // 如果是snippet，直接插入item的name到textarea中，而不是插入到inputTags中
  if (item.type === 'snippet') {
    const text = textarea.value;
    const queryLength = tagQuery.length + 1;
    // 从snippetCache中找到对应的snippet,取出content的内容，存储到一个content变量中
    const content = snippetCache.find(snippet => snippet.name === item.name).content

    textarea.value = text.substring(0, position - queryLength) + content + text.substring(position);
    inputText.value = textarea.value;
    textarea.selectionStart = position - queryLength + content.length;
    textarea.selectionEnd = position - queryLength + content.length;
    tagQuery = "";
    adjustHeight();
    return;
  }

  // 如果inputTags.value中已经存在相同的条目，则不push进去
  const hasSameItem = inputTags.value.some(tag => {
    return tag.name === item.name && tag.type === item.type
  })
  if (!hasSameItem) {
    inputTags.value.push({ name: item.name, type: item.type, color: tagColor[item.type] })
  }

  setTimeout(() => {
    let text = textarea.value;
    const queryLength = tagQuery.length + 1;
    textarea.value = text.substring(0, position - queryLength) + text.substring(position);
    inputText.value = textarea.value;
    textarea.selectionStart = position - queryLength;
    textarea.selectionEnd = position - queryLength;
    tagQuery = ""
    adjustHeight()
  }, 50)
}

// 取消etag列表的显示
function cancel() {
  caretPosition = {
    display: "none"
  }
  showList.value = false;
  tagQuery = ""
}

// 处理用户输入按键指令，包括调用etag接口，上下键选择，回车键确认
function onKeyDown(event) {
  state.editable = state.editable.map(() => false) // 输入时禁止对话编辑


  //新建page快捷键
  if (event.ctrlKey && event.key === 't' && process.platform !== 'darwin') {
    newPage();
    return;
  } else if (event.metaKey && event.key === 't' && process.platform === 'darwin') {
    newPage();
    return;
  }

  // 按下ctrl+y，显示历史记录查询窗口
  if (event.ctrlKey && event.key === 'f' && process.platform !== 'darwin') {
    toggleHistory();
    return;
  } else if (event.metaKey && event.key === 'f' && process.platform === 'darwin') {
    toggleHistory();
    return;
  }

  // 按下ctrl+[，显示上一页
  if (event.ctrlKey && event.key === '[' && process.platform !== 'darwin' && !followMode.value) {
    nextPage();
    return;
  } else if (event.metaKey && event.key === '[' && process.platform === 'darwin' && !followMode.value) {
    nextPage();
    return;
  }

  // 按下ctrl+]，显示下一页
  if (event.ctrlKey && event.key === ']' && process.platform !== 'darwin' && !followMode.value) {
    prevPage();
    return;
  } else if (event.metaKey && event.key === ']' && process.platform === 'darwin' && !followMode.value) {
    prevPage();
    return;
  }


  const key = event.key;
  if (showList.value) {
    if ((key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === "Enter")) {
      event.preventDefault();
      const itemList = listRef.value.querySelectorAll('li');

      let selectedIndex = -1;
      for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].classList.contains('selected')) {
          selectedIndex = i;
          break;
        }
      }
      if (key === 'ArrowUp' && selectedIndex > 0) {
        itemList[selectedIndex].classList.remove('selected');
        itemList[selectedIndex - 1].classList.add('selected');
        itemList[selectedIndex - 1].scrollIntoView({ block: 'nearest' }); // 滚动到可视区域
        // scrollToItem(itemList[selectedIndex - 1]);
      } else if (key === 'ArrowDown' && selectedIndex < itemList.length - 1) {
        if (selectedIndex >= 0) {
          itemList[selectedIndex].classList.remove('selected');
        }
        itemList[selectedIndex + 1].classList.add('selected');
        // scrollToItem(itemList[selectedIndex + 1]);
        itemList[selectedIndex + 1].scrollIntoView({ block: 'nearest' });
      }
      if (key === 'Enter') {
        event.preventDefault()
        const itemList = listRef.value.querySelectorAll('li');
        for (let i = 0; i < itemList.length; i++) {
          if (itemList[i].classList.contains('selected')) {
            selectItem(tagList.value[i]);
            break;
          }
        }
        setTimeout(() => {
          caretPosition = { display: "none" }
          showList.value = false;
        }, 50)
      }
    } else if (key === 'Escape') {
      cancel()
    } else if (/^[a-zA-Z0-9_-]$/.test(key)) { // 输入字母、数字、减号或下划线模式
      tagQuery += key;
      // 根据tagQuery的值，从tabListCache中筛选出符合条件的tag,查询方法是从开头匹配字符串
      tagList.value = tagListCache.filter(item => {
        return item.abbr.includes(tagQuery)
      })
      if (tagList.value.length === 0) {
        cancel()
      }
    } else if (key === 'Backspace') {
      if (tagQuery === "") {
        cancel()
      } else {
        tagQuery = tagQuery.slice(0, -1);
        if (tagQuery === "") {
          tagList.value = tagListCache
        } else {
          tagList.value = tagListCache.filter(item => {
            return item.abbr.includes(tagQuery)
          })
        }
        if (tagList.value.length === 0) {
          cancel()
        }
      }
    }

  } else { // 输入文字模式
    if (key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendRequests()
    }
    if (key === '/') {
      tagList.value = tagListCache

      // 如果tagList不为空，且tagList中没有已经被选中的li, 则显示tagList，并且第一个li被选中
      let itemList = []
      if (tagList.value.length > 0) {
        setTimeout(() => {
          itemList = listRef.value.querySelectorAll('li')
          if (itemList.length > 0) {
            let flag = false
            for (let i = 0; i < itemList.length; i++) {
              if (itemList[i].classList.contains('selected')) {
                flag = true
                break
              }
            }
            if (!flag) {
              itemList[0].classList.add('selected')
            }
          }
        }, 500)
      }
      caretPosition = {
        display: "flex"
      }
      showList.value = true;
    }
  }
}

// 把输入的文字转换成拼音首字母缩写
function textAbbr(text) {
  const pinyinArr = pinyin(text, {
    style: pinyin.STYLE_FIRST_LETTER
  });
  let result = pinyinArr.join('');
  return result.toLowerCase();
}

/**
 * Uploads a file to the server based on the input tags.
 * If the input tags contain a tag with name including "File" and type "engine", the file is uploaded file path.
 * Otherwise, the file is uploaded as text data.
 * @param {string} filePath - The path of the file to be uploaded.
 */
function uploadFile(filePath) {
  // inputTags.value is an array, each element includes name, type, and color. 
  // Need to check if the name includes "File" and the type is "engine".
  if (inputTags.value.some(tag => tag.name.includes('File') && tag.type === 'engine')) {
    axios.post('http://127.0.0.1:7860/run/upload_file', {
      data: [filePath]
    }).then(response => {
      setTimeout(() => {
        QAcontext.value = response['data']['data'][0]
        md2html()
      }, 100);
    }).catch(error => {
      console.error(error);
    });
  } else {
    axios.post('http://127.0.0.1:7860/run/upload_text', {
      data: [filePath]
    }).then(response => {
      QAcontext.value = response['data']['data'][0]
      inputRef.value.focus()
      reviewMode = true;
      setTimeout(() => {
        QAcontext.value = response['data']['data'][0]
        md2html()
      }, 100);
    }).catch(error => {
      console.error(error);
    });
  }
}

const getSystemTheme = async () => {
  const result = await ipcRenderer.invoke('get-system-theme')
  return result
}

// 页面加载时的各种初始化
function addEventListeners() {
  let win = getCurrentWindow();
  window.addEventListener('mousemove', (event) => {
    let flag = event.target.classList.contains('permeable');
    if (flag && isLock) {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
    else {
      win.setIgnoreMouseEvents(false);
    }
  })

  win.on('move', debounce(() => {
    setState();
  }))

  win.on('resize', debounce(() => {
    setState();
  }))

  win.on('show', () => {
    const inputArea = document.querySelector('#inputArea');
    inputArea.style.backgroundColor = 'var(--el-bg-inputarea)';
    clearTimeout(transparentTimeout);
  })

  // 注册拖拽文件上传的处理  
  const inputArea = document.querySelector('#inputArea');
  inputArea.addEventListener('dragover', (event) => {
    placeholderText.value = '松开鼠标传入文件'
    inputArea.style.border = '2px dashed #555';
    inputArea.style.borderWidth = '2px';
    event.preventDefault();
  })
  inputArea.addEventListener('dragleave', () => {
    placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    inputArea.removeAttribute('style');
  });

  inputArea.addEventListener('drop', (event) => {
    inputArea.removeAttribute('style');
    const filePath = event.dataTransfer.files[0].path
    placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    console.log(filePath)
    // 把文件传入braindoor并切块
    uploadFile(filePath)
    event.preventDefault();
  })
}

function removeEventListeners() {
  let win = getCurrentWindow();
  window.removeEventListener('mousemove', () => {
    let flag = event.target.classList.contains('permeable');
    if (flag && isLock) {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
    else {
      win.setIgnoreMouseEvents(false);
    }
  })

  win.off('move', debounce(() => {
    setState();
  }))

  win.off('resize', debounce(() => {
    setState();
  }))

  const inputArea = document.querySelector('#inputArea');
  inputArea.removeEventListener('dragover', () => {
    placeholderText.value = '松开鼠标传入文件'
    inputArea.style.border = '2px dashed #555';
    inputArea.style.borderWidth = '2px';
    event.preventDefault();
  })
  inputArea.removeEventListener('dragleave', () => {
    placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    inputArea.removeAttribute('style');
  });

  inputArea.removeEventListener('drop', () => {
    inputArea.removeAttribute('style');
    const filePath = event.dataTransfer.files[0].path
    placeholderText.value = '目前是文档问答模式，你可以针对上传的文档提问'
    console.log(filePath)
    // 把文件传入braindoor并切块
    uploadFile(filePath)
    event.preventDefault();
  })
}

onMounted(async () => {
  addWebChatTag();
  updateTheme()
  window.testFn = function () {
    drawer.value = true;
  }
  addEventListeners();
  contactBrainoor();
  setTimeout(() => {
    adjustHeight();
  }, 50)
  getState();

  // 在这里你可以处理从主进程接收到的剪贴板内容
  ipcRenderer.on('clipboard-data', (event, text) => {
    // 如果app目前是隐藏状态，显示app
    if (getCurrentWindow().isVisible() === false) {
      getCurrentWindow().show();
    }
    const inputArea = document.querySelector('#inputArea');
    inputArea.style.backgroundColor = 'var(--el-bg-inputarea)';
    clearTimeout(transparentTimeout);

    newPage();
    inputText.value = text + '\n\n';
    // 把app置于前台并激活

    nextTick(() => {
      inputRef.value.focus();
      inputRef.value.textarea.scrollTop = inputRef.value.textarea.scrollHeight;
    });
  });

  // 接收到主进程发送follow-mode的消息，follow-mode的值为true或false
  ipcRenderer.on('follow-mode', (event, mode) => {
    followMode.value = mode;
    if (followMode.value) {
      drawer.value = false;
      webDrawer.value = false;
    }
  });


  //从localstorage中读取askHotkey的值，如果有，发送到主进程
  const askHotkey = localStorage.getItem('askHotkey');
  if (askHotkey) {
    ipcRenderer.send('setAskHotkey', askHotkey);
  }

  

})


onUnmounted(() => {
  removeEventListeners();
})


// 重新编辑对话按钮功能
let state = reactive({
  editable: QAcontext.value.map(() => false),
});
let preQRefs = reactive({});
let { editable } = toRefs(state);
function toggleEditable(index) {
  editable.value[index] = !editable.value[index];
  if (!editable.value[index]) {
    let preQText = preQRefs[`preQ-${index}`].textContent;
    inputText.value = preQText;
    sendRequests(index);
  }
}

function hideWin() {
  if(isMac){
    getCurrentWindow().hide();
  } else {
    // 给主进程发一个最小化的消息
    ipcRenderer.send('clickMinimize');
  }
  
}

// 取消编辑模式
function cancelEditable(index) {
  preQRefs[`preQ-${index}`].textContent = QAcontext.value[index][0];
  editable.value[index] = false;
}

// 复制内容按钮功能
const contentRefs = reactive({});
function copyContent(index) {
  const textToCopy = contentRefs[`A-${index}`].textContent;
  navigator.clipboard.writeText(textToCopy)
}

const toggleHistory = () => {
  showHistory.value = !showHistory.value;
  query.value = null;
  if (showHistory.value) {
    nextTick(() => {
      historyRef.value.inputRef.focus();
      historyRef.value.inputRef.addEventListener('keydown', handleQueryKeyPress)
    })
  }
}

// ESC键关闭历史记录查询
function handleQueryKeyPress(event) {
  if (event.keyCode === 27) { // Enter key
    showHistory.value = false;
    nextTick(() => {
      inputRef.value.focus();
    })
  }
}

const remoteMethod = (query) => {
  historyLoading.value = true
  // 从 api 获取历史记录
  axios.post('http://127.0.0.1:7860/run/history_filter', {
    data: [query]
  }).then(response => {
    // console.log(response['data']['data'][0])
    const arr = response['data']['data'][0]['data']

    // arr是一个数组，包括page,title,index,现在把它转为一个对象，分别为value,label,key
    queryResult.value = arr.map((item) => {
      return {
        value: item[0],
        label: item[1],
        key: item[2]
      }
    })
    historyLoading.value = false
  }).catch(error => {
    console.error(error);
  });
}

const selectHistoryItem = (item) => {
  console.log(item)
  jumpPage(item)
}


function addCodeCopy() {
  // 获取具有 markdown-it-code-copy 类的元素
  const copyButtons = document.querySelectorAll(".markdown-it-code-copy");
  // 为每个按钮添加点击事件监听器
  copyButtons.forEach(button => {
    button.addEventListener("click", function () {
      const textToCopy = this.getAttribute("data-clipboard-text");
      // 将文本复制到剪贴板
      if (textToCopy) {
        clipboard.writeText(textToCopy)
      }
    });
  });
}

function handleWebDrawerOpen() {
  // 向主进程发送一个消失，告知WebDrawer打开了
  ipcRenderer.send('webDrawerOpen');

  // 向webview发送一个消息，输入inputArea的内容
  let inputText = inputRef.value?.textarea?.value;

  if (inputText=="") {
    console.log(QAcontext.value[QAcontext.value.length - 1][0])
    inputText = QAcontext.value[QAcontext.value.length - 1][0]
  }
  if (inputText) {
    WebChatRef1.value.inputTextIntoWebview(inputText);
    WebChatRef2.value.inputTextIntoWebview(inputText);
  }

}


function handleWebDrawerClose() {
  // 向主进程发送一个消失，告知WebDrawer关闭了
  ipcRenderer.send('webDrawerClose');
}

function refreshChildWebview() {
  WebChatRef1.value.refreshWebview();
  WebChatRef2.value.refreshWebview();
}

function zoomWin(){
  // 第一次按下的时候，向主进程发送放大消息
  // 再次按下的时候，向主进程发送恢复消息
  if(!zoomed){
    ipcRenderer.send('zoom');
    zoomed = true;
  } else {
    ipcRenderer.send('zoomRestore');
    zoomed = false;
  }
}

</script>

////////////////////////////////////////////
<template>
  <html :class="themeHTML">
  <el-row justify="center" align="bottom" class="QAs permeable" :style="{ height: bodyHeight }">
    <el-col :span="24" gutter="10" class="permeable">
      <el-scrollbar class="permeable" ref="scrollbarRef" :max-height="bodyHeight">
        <TransitionGroup tag="div" name="slide">
          <div class="grid-content QA permeable" v-for="(round, index) in QAcontext" :key="index">
            <div>
              <div class="Q" style="position:relative;"
                @keydown.enter.exact="editable[index] ? toggleEditable(index) : null"
                @keydown.esc="editable[index] ? cancelEditable(index) : null">
                <div style="position:absolute; right:10px; bottom:8px;">
                  <el-button :icon="Edit" link color="black" size="large" @click="toggleEditable(index)"
                    v-if="!editable[index]" v-show="connected" />
                  <el-button size='small' v-if="editable[index]" type="primary" :icon="Check"
                    style="position:absolute; right:40px; bottom:-20px;" @click="toggleEditable(index)"></el-button>
                  <el-button size='small' v-if="editable[index]" @click="cancelEditable(index)" :icon="Close"
                    style="position:absolute; right:0px; bottom:-20px;" type="info"></el-button>
                </div>
                <pre class="preQ" :contenteditable="editable[index]"
                  :ref="el => preQRefs[`preQ-${index}`] = el">{{ round[0] }}</pre>
              </div>
            </div>
            <div>
              <div class="Acontainer" style="position:relative;" :ref="el => contentRefs[`A-${index}`] = el">
                <div class="A" v-html="round[1]" />
                <el-button :icon="CopyDocument" link color="black" size="large"
                  style="position:absolute; right:10px; bottom:8px;" @click="copyContent(index)" v-show="connected" />
              </div>
            </div>
          </div>
          <!-- <div class="Q" style="position:relative;">
            clipboard
          </div> -->
        </TransitionGroup>
      </el-scrollbar>
    </el-col>
  </el-row>
  <el-footer class="footer">
    <div id="TagPopContainer">
      <Transition>
        <div ref="listRef" class="popList" :style="caretPosition" v-show="showList">
          <ul>
            <el-scrollbar id="pop_scrollbar" height="150px" v-if="showList">
              <li v-for="(item, index) in tagList" :key="index" @click="selectItem(item)" class="tag-item"
                style="display: table; width: 100%;">
                <el-text :type="item.color" style="display: table-row;">
                  <span style="display: table-cell; text-align: left;">{{ item.name }}</span>
                  <span style="display: table-cell; text-align: right;">[{{ item.type }}]</span>
                </el-text>
              </li>
            </el-scrollbar>
          </ul>
        </div>
      </Transition>
      <el-select-v2 v-model="query" filterable class="historyList" :options="queryResult" placeholder="查询对话历史"
        style="width: 240px" v-if="showHistory" remote :remote-method="remoteMethod" placement='top'
        :loading="historyLoading" :effect='themeHTML' ref="historyRef" @change="selectHistoryItem" />

      <div class="tagBox" ref="tagBoxRef">
        <el-tag v-for="tag in inputTags" :key="tag" class="etag" closable round size="small" :type="tag.color"
          effect="dark" :disable-transitions="true" @close="handleTagClose(tag)">
          {{ tag.name }}
        </el-tag>
      </div>
      <el-tooltip content="隐藏" placement="top" :hide-after="hideAfter">
        <el-button size="small" text class="hide-button" :icon="CaretBottom" type="info" @click="hideWin"/>
      </el-tooltip>
      <div id="inputArea" class="inputAreaContainer" :class="{ 'InputFocus': isInputFocus }" @mouseover="inputAreaFocus"
        @mouseleave="inputAreaBlur">
        <!-- 如果要shift+enter提交，设置@keydown.shift.enter.prevent -->
        <el-row>
          <el-input id="textArea" v-model="inputText" @input="handleInput" type="textarea" ref="inputRef"
            :placeholder="placeholderText" resize="none" @focus="textAreaFocus" @blur="textAreaBlur" @mouseover="hoverNewPage = false"
            :autosize="{ minRows: 1, maxRows: 8 }" :disabled="streaming" @keydown="onKeyDown" autofocus>
          </el-input>
        </el-row>
        <el-row class="toolbar">
          <el-button type="info" plain size="small" v-show="streaming" class="stop-button" @click="stopRequest">
            ⏹ Stop
          </el-button>
         

          <div class="toolbar-inner">
            <div style="width: 160px;" @mouseover="toolbarOnHover" @mouseleave="toolbarOnLeave">
              <el-tooltip content="新建对话 cmd/ctrl+t" placement="top" :hide-after="hideAfter">
                <Transition name="fade">
                  <el-button :icon="DocumentAdd" text circle @click="newPage" type="info" :disabled="streaming" @mouseover="hoverNewPage = true"
                    v-show="!streaming && connected && !followMode" />
                </Transition>
              </el-tooltip>
              <el-popconfirm title="确定删除当前对话?" :hide-after="0" confirm-button-type="danger" position="top"
                @confirm="delPage" placement="top">
                <template #reference>
                  <Transition name="fade">
                    <el-button :icon="Delete" text circle type="info" :disabled="streaming"
                      v-show="!streaming && connected && !followMode && !hoverNewPage"  />
                  </Transition>
                </template>
              </el-popconfirm>
              <el-tooltip content="无框" placement="top" :hide-after="hideAfter">
                <Transition name="fade">
                  <el-button :icon="Lock" text circle @click="lock" type="info" :disabled="streaming"
                    v-show="!streaming && connected && !followMode && !hoverNewPage" />
                </Transition>
              </el-tooltip>

              <el-tooltip content="设置" placement="top" :hide-after="hideAfter">
                <el-button :icon="Setting" text circle type="info" v-show="connected && !streaming && !followMode && !hoverNewPage" :disabled="streaming"
                  @click="drawer = true" />
              </el-tooltip>

              <el-tooltip content="WebChat" placement="top" :hide-after="hideAfter">
                <el-button :icon="ChromeFilled" text circle type="info" v-show="connected && !streaming && !followMode && hoverNewPage" :disabled="streaming"
                  @click="webDrawer = true" />
              </el-tooltip>
            </div>

            <el-tooltip content="可拖动区域" placement="top" :hide-after="hideAfter">
              <div class="drag-area" @mouseover="hoverNewPage=false">
              </div>
            </el-tooltip>

            <!-- <el-col :span="7" class="right-align" v-show="!streaming && connected"> -->
            <div class="page-box" v-show="!streaming && connected && !followMode">
              <el-button :icon="ArrowLeft" link circle type="info" @click="nextPage"
                :disabled="streaming && !connected" />
              <el-tooltip content="查询历史" placement="top" :hide-after="hideAfter">
                <el-text style="cursor:pointer" size='small' type="info" @click="toggleHistory">{{ pageInfo }}</el-text>
              </el-tooltip>
              <el-button :icon="ArrowRight" link circle type="info" @click="prevPage"
                :disabled="streaming && !connected" />
            </div>
          </div>
        </el-row>
      </div>
    </div>
    <el-drawer v-model="drawer" title="设置" :with-header="true" direction="btt" size="90%" destroy-on-close>
      <el-tabs v-model="activeSettingTab" class="demo-tabs">
        <el-tab-pane label="常规" name="normal">
          <GeneralConfig />
        </el-tab-pane>
        <el-tab-pane label="建库" name="createBase">
          <CreateBase />
        </el-tab-pane>
        <el-tab-pane label="更新库" name="updateBase">
          <UpdateBase />
        </el-tab-pane>
        <el-tab-pane label="关于" name="about">
          <AboutThis />
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
    <el-drawer v-model="webDrawer" title="WebChat" :with-header="true" direction="btt" size="100%" @open="handleWebDrawerOpen" @close="handleWebDrawerClose" :show-close="false">
      <template #header="{ close, titleId, titleClass }">
      <h4 :id="titleId" :class="titleClass" class="drag-area">WebChat</h4>
      <el-tooltip content="重新载入" placement="top" :hide-after="hideAfter">
        <el-button text :icon="Refresh" circle @click="refreshChildWebview"/>
      </el-tooltip>
      <el-tooltip content="缩放窗口" placement="top" :hide-after="hideAfter">
        <el-button text :icon="Switch" circle @click="zoomWin"/>
      </el-tooltip>
      <el-tooltip content="全部隐藏" placement="top" :hide-after="hideAfter">
        <el-button text :icon="Hide" circle @click="hideWin"/>
      </el-tooltip>
      <el-tooltip content="关闭WebChat" placement="top" :hide-after="hideAfter">
        <el-button text :icon="CloseBold" circle @click="close"/>
      </el-tooltip>
      
    </template>
      <el-tabs v-model="activeWebTab" class="web-tabs">
        <el-tab-pane label="ChatGPT" name="chatgpt-web" class="web-pane">
          <WebChat ref="WebChatRef1" />
        </el-tab-pane>
        <el-tab-pane label="Claude2" name="claude-web" class="web-pane">
          <WebChat2 ref="WebChatRef2" />
        </el-tab-pane>
        <el-tab-pane label="Bing" name="bing-web" class="web-pane">
          <WebChat3 ref="WebChatRef3" />
        </el-tab-pane>
      </el-tabs>  
    </el-drawer>
  </el-footer>

  </html>
</template>

////////////////////////////////////////////

<style src="./style.css"></style>
