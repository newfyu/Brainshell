<template>
  <div id="MagicInput">
  <div>
      <div ref="list" class="list" :style="caretPosition" v-show="showList">
        <ul>
          <li v-for="(item, index) in itemList" :key="index" @click="selectItem(item)">
            {{ item }}
          </li>
        </ul>
      </div>
      <textarea v-model="content" @input="handleInput" ref="inputRef"></textarea>
  </div>
  
  
  </div>
  </template>
  
  <script>

  
  export default {
    name: 'App',
    data(){
      return{
        itemList: ['Item 1', 'Item 2', 'Item 3'],
        caretPosition: {left: 0, top: 0},
        content:''
      }
    },
    methods: {
      handleInput(event) {
        const text = event.target.value;
        const cursorPos = event.target.selectionStart;
        const input = this.$refs.inputRef;
        const rect = input.getBoundingClientRect(); // 获得绝对坐标
        console.log(rect)
        this.caretPosition = {
          left: `${rect.x + cursorPos*8}px`, // 还要考虑换行什么的
          bottom: '0px',
          color: 'red',
          zIndex: 9999,
        }
        console.log(this.caretPosition.top)
        if (text[cursorPos - 1] === '#') {
          this.showList = true;
        } else {
          this.showList = false;
        }
      },
      selectItem(item) {
        this.content += item;
        this.showList = false;
      },
    },
    }
  </script>
  
  <style>
  .list {
    position: absolute;
    background-color: white;
    border: 1px solid gray;
    max-height: 150px;
    overflow-y: auto;
  }
  </style>
  