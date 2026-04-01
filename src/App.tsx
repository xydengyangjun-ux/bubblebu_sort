import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';
import { Send, Play, Code2, Bot, User, Loader2 } from 'lucide-react';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'system',
    content: `你是一个友好的Python编程老师，正在辅导学生从零开始写一个冒泡排序（Bubble Sort）算法。
请遵循以下原则：
1. 引导学生一步一步（甚至一行一行）地写代码。
2. 绝对不要直接给出完整的最终代码。
3. 每次只关注当前的一小步，例如：先定义函数，再写外层循环，再写内层循环，最后写交换逻辑。
4. 当学生提交代码时，检查他们的代码是否正确。如果正确，给予鼓励并提示下一步；如果错误，温和地指出错误并给出提示。
5. 语言要生动、鼓励性强，适合初学者。`
  },
  {
    role: 'assistant',
    content: '你好！我是你的AI编程伴学小助手。今天我们要一起用Python写一个**冒泡排序（Bubble Sort）**算法。准备好了吗？\n\n我们先从第一步开始：请你在右侧的代码编辑器里，定义一个名为 `bubble_sort` 的函数，它接收一个参数 `arr`（代表要排序的列表）。写好后点击“提交代码”让我看看吧！'
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('# 在这里编写你的Python代码\n');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string, isCodeSubmission: boolean = false) => {
    if (!text.trim() && !isCodeSubmission) return;

    let userContent = text;
    if (isCodeSubmission) {
      userContent = `这是我当前写的代码，请帮我检查并指导下一步：\n\`\`\`python\n${code}\n\`\`\`\n${text ? '我的问题/留言：' + text : ''}`;
    }

    const newMessages = [...messages, { role: 'user', content: userContent } as Message];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Add a temporary assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-eb65e011c69a4e1cb667eecdfce990a8'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: newMessages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let assistantContent = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices[0].delta.content) {
                  assistantContent += data.choices[0].delta.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1].content = assistantContent;
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = '抱歉，请求出错，请稍后重试。';
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-neutral-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 text-blue-600">
          <Code2 className="w-6 h-6" />
          <h1 className="text-xl font-bold text-neutral-800">Python 冒泡排序 AI伴学</h1>
        </div>
        <div className="text-sm text-neutral-500">
          Powered by DeepSeek
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel: Chat */}
        <div className="w-1/2 flex flex-col border-r border-neutral-200 bg-white">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.filter(m => m.role !== 'system').map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1].role === 'user' && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-neutral-100 rounded-2xl px-5 py-4 flex items-center gap-2 text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI正在思考...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-neutral-200 bg-white shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="向AI助手提问或留言..."
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={isLoading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                发送
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Code Editor */}
        <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
          <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040] shrink-0">
            <div className="text-sm text-neutral-300 font-mono">main.py</div>
            <button
              onClick={() => handleSend('', true)}
              disabled={isLoading}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              提交代码给AI检查
            </button>
          </div>
          <div className="flex-1 overflow-auto relative p-4">
            <Editor
              value={code}
              onValueChange={code => setCode(code)}
              highlight={code => Prism.highlight(code, Prism.languages.python, 'python')}
              padding={16}
              style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 14,
                minHeight: '100%',
                color: '#d4d4d4',
                backgroundColor: '#1e1e1e',
                outline: 'none'
              }}
              className="editor-container"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
