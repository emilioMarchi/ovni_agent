// OVNI Chat Widget Loader - universal para cualquier sitio web
(function(){
  if (window.OvniWidget) return; // Evitar doble carga
  window.OvniWidget = {
    init: function(config) {
      if (document.getElementById('ovniWidget')) return;
      // Cargar CSS
      var style = document.createElement('style');
      style.innerHTML = `:root { --primary-bg: #b0c4de; --border-color: #e5e1da; --text-color: #1a1a1a; --agent-bubble-border: #6c88a3; --user-bubble-border: #8b7d6b; } * { box-sizing: border-box; margin: 0; padding: 0; } body, html { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: transparent; } .ovni-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999999; } .ovni-toggle { width: 55px; height: 55px; border-radius: 50%; background: var(--primary-bg); border: 2px solid var(--border-color); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.08); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; padding: 2px; } .ovni-toggle:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); } .ovni-toggle img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; } .ovni-toggle svg.icon-close { display: none; width: 24px; height: 24px; fill: var(--text-color); opacity: 0.6; } .ovni-toggle.open img { display: none; } .ovni-toggle.open svg.icon-close { display: block; } .ovni-window { position: absolute; bottom: 70px; right: 0; width: 320px; height: 450px; background: var(--primary-bg); border: 2px solid var(--border-color); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); opacity: 0; visibility: hidden; transform: translateY(10px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); } .ovni-window.open { opacity: 1; visibility: visible; transform: translateY(0); } .ovni-header { padding: 18px 15px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(229, 225, 218, 0.5); } .ovni-header-info h3 { color: var(--text-color); font-size: 15px; font-weight: 500; letter-spacing: 0.3px; } .ovni-messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; scrollbar-width: none; } .ovni-messages::-webkit-scrollbar { display: none; } .empty-chat-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-color); opacity: 0.3; font-size: 13px; text-align: center; padding: 20px; animation: message-in 0.6s ease forwards; } .message-container { display: flex; width: 100%; opacity: 0; transform: translateY(10px); animation: message-in 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards; } @keyframes message-in { to { opacity: 1; transform: translateY(0); } } .message-container.user { justify-content: flex-end; } .message-container.assistant { justify-content: flex-start; gap: 8px; } .avatar { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-color); object-fit: cover; flex-shrink: 0; } .ovni-message { max-width: 75%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; word-wrap: break-word; background: transparent; color: var(--text-color); } .ovni-message.user { border: 1px solid var(--user-bubble-border); border-bottom-right-radius: 4px; } .ovni-message.assistant { border: 1px solid var(--agent-bubble-border); border-bottom-left-radius: 4px; } .typing-indicator { display: inline-flex; gap: 5px; padding: 4px 8px; } .dot { width: 5px; height: 5px; background-color: var(--agent-bubble-border); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; opacity: 0.6; } .dot:nth-child(1) { animation-delay: -0.32s; } .dot:nth-child(2) { animation-delay: -0.16s; } @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1.2); opacity: 1; } } .ovni-input-area { padding: 12px 15px 20px; background: transparent; display: flex; align-items: center; gap: 10px; } .input-wrapper { flex: 1; position: relative; display: flex; align-items: center; } .ovni-input { width: 100%; background: rgba(255, 255, 255, 0.1); border: 1px solid var(--border-color); border-radius: 20px; padding: 9px 40px 9px 15px; outline: none; font-size: 14px; color: var(--text-color); transition: border-color 0.2s; } .ovni-input::placeholder { color: rgba(26, 26, 26, 0.4); } .ovni-input:focus { border-color: var(--agent-bubble-border); background: rgba(255, 255, 255, 0.2); } .audio-trigger { position: absolute; right: 12px; background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-color); opacity: 0.4; transition: opacity 0.2s; } .ovni-send { background: none; border: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-color); opacity: 0.6; transition: all 0.2s; } .ovni-send:hover { opacity: 1; transform: translateX(2px); } .ovni-send:disabled { opacity: 0.2; cursor: default; } @media (max-width: 480px) { .ovni-window { width: calc(100vw - 40px); height: 60vh; } }`;
      document.head.appendChild(style);
      // Cargar HTML
      var div = document.createElement('div');
      div.innerHTML = `<div class="ovni-widget" id="ovniWidget"><div class="ovni-window" id="ovniWindow"><div class="ovni-header"><div class="ovni-header-info"><h3 id="agentName">Asistente</h3></div></div><div class="ovni-messages" id="ovniMessages"></div><div class="ovni-input-area"><div class="input-wrapper"><input type="text" class="ovni-input" id="ovniInput" placeholder="Mensaje..." autocomplete="off"><button class="audio-trigger" title="Audio próximamente"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg></button></div><button class="ovni-send" id="ovniSend"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div><button class="ovni-toggle" id="ovniToggle"><img src="/logo.png" alt="OVNI"><svg class="icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></div>`;
      document.body.appendChild(div);

      // --- OvniChatWidget class (adapted for loader) ---
      class OvniChatWidget {
        constructor(config) {
          this.apiUrl = config.apiUrl || window.location.origin;
          this.agentId = config.agentId;
          this.clientId = config.clientId;
          this.agentName = config.agentName || null;
          this.threadId = localStorage.getItem('ovni_thread_' + this.agentId);
          this.isOpen = false;
          this.isLoading = false;
          this.init();
        }

        init() {
          const toggle = document.getElementById('ovniToggle');
          const send = document.getElementById('ovniSend');
          const input = document.getElementById('ovniInput');

          toggle.addEventListener('click', () => this.toggle());
          send.addEventListener('click', () => this.sendMessage());
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
          });

          window.addEventListener('beforeunload', () => this.endSession());

          if (this.agentId) {
            this.loadAgentInfo();
          }
        }

        async endSession() {
          if (!this.threadId) return;
          try {
            // Endpoint dedicado que solo marca la sesión como terminada sin invocar el modelo
            await fetch(`${this.apiUrl}/api/chat/end-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-client-id': this.clientId
              },
              body: JSON.stringify({
                agentId: this.agentId,
                clientId: this.clientId,
                threadId: this.threadId,
              }),
              keepalive: true,
            });
          } catch (e) {}
          // Limpiar threadId del localStorage al finalizar la sesión
          localStorage.removeItem('ovni_thread_' + this.agentId);
          this.threadId = null;
        }

        toggle() {
          this.isOpen = !this.isOpen;
          const windowEl = document.getElementById('ovniWindow');
          const toggle = document.getElementById('ovniToggle');
          windowEl.classList.toggle('open', this.isOpen);
          toggle.classList.toggle('open', this.isOpen);
          if (this.isOpen) {
            document.getElementById('ovniInput').focus();
          }
        }

        async loadAgentInfo() {
          try {
            let agentName = this.agentName;
            let welcomeMessage = '';
            let agent = null;
            if (!agentName && this.agentId) {
              try {
                const res = await fetch(`${this.apiUrl}/api/agents/${this.agentId}`, {
                  headers: { 'x-client-id': this.clientId }
                });
                const data = await res.json();
                if (data.success && data.data) {
                  agent = data.data;
                  agentName = agent.name || 'Asistente';
                  welcomeMessage = agent.welcomeMessage || '';
                }
              } catch (e) {}
            }
            if (!agentName) {
              const res = await fetch(`${this.apiUrl}/api/chat/agents?clientId=${this.clientId}`, {
                headers: { 'x-client-id': this.clientId }
              });
              const data = await res.json();
              if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                agent = data.data.find(a => a.id === this.agentId) || data.data[0];
                agentName = agent.name || 'Asistente';
                welcomeMessage = agent.welcomeMessage || '';
              } else {
                agentName = 'Asistente';
              }
            }
            document.getElementById('agentName').textContent = agentName;
            if (welcomeMessage && welcomeMessage.trim() !== '' && !this.threadId) {
              await this.addSequentialMessages(welcomeMessage);
            } else if (!this.threadId) {
              this.showEmptyHint(agentName);
            }
            if (this.threadId) {
              // Historial ahora se recupera solo desde el backend/grafo, no desde el widget
            }
          } catch (err) {
            document.getElementById('agentName').textContent = this.agentName || 'Asistente';
            this.showEmptyHint(this.agentName || 'Asistente');
          }
        }

        async loadHistory() {
          try {
            const res = await fetch(`${this.apiUrl}/api/chat/history/${this.threadId}`, {
              headers: { 'x-client-id': this.clientId }
            });
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
              const hint = document.getElementById('emptyChatHint');
              if (hint) hint.remove();
              for (const msg of data.data) {
                if (msg.role === 'tool') continue;
                const type = msg.role === 'user' ? 'user' : 'assistant';
                this.addMessage(this.cleanAssistantMessage(msg.content), type);
              }
            }
          } catch (err) {}
        }

        cleanAssistantMessage(content) {
          if (typeof content !== 'string') return String(content);
          let cleaned = content;
          cleaned = cleaned.replace(/\[{\"functionCall\":\s*\{[^}]+\}"thoughtSignature":"[^"]+"\}\]/g, '');
          cleaned = cleaned.replace(/\[{\"functionCall\":\s*\{[^}]+\}\}\]/g, '');
          cleaned = cleaned.replace(/\[TOOL\[Info.*?\]\]/gi, '');
          cleaned = cleaned.replace(/\}\s*,\s*\{/g, ', ');
          cleaned = cleaned.trim();
          if (!cleaned) return '...';
          return cleaned;
        }

        showEmptyHint(name) {
          const container = document.getElementById('ovniMessages');
          const hint = document.createElement('div');
          hint.className = 'empty-chat-hint';
          hint.id = 'emptyChatHint';
          hint.innerHTML = `<p>Escribile a ${name}</p>`;
          container.appendChild(hint);
        }

        addMessage(content, type) {
          const hint = document.getElementById('emptyChatHint');
          if (hint) hint.remove();
          const container = document.getElementById('ovniMessages');
          const wrapper = document.createElement('div');
          wrapper.className = `message-container ${type}`;
          let html = '';
          if (type === 'assistant') {
            html += `<img src="/logo.png" class="avatar">`;
          }
          const formattedContent = content.replace(/\n/g, '<br>');
          html += `<div class="ovni-message ${type}">${formattedContent}</div>`;
          wrapper.innerHTML = html;
          container.appendChild(wrapper);
          container.scrollTop = container.scrollHeight;
          return wrapper;
        }

        async addSequentialMessages(content) {
          const paragraphs = content.split(/\n\n+/).filter(p => p.trim() !== '');
          for (let i = 0; i < paragraphs.length; i++) {
            if (i > 0) {
              this.showTyping();
              await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
              this.hideTyping();
            }
            this.addMessage(paragraphs[i].trim(), 'assistant');
          }
        }

        showTyping() {
          const container = document.getElementById('ovniMessages');
          const wrapper = document.createElement('div');
          wrapper.className = 'message-container assistant typing-indicator-wrapper';
          wrapper.id = 'typingIndicator';
          wrapper.innerHTML = `
            <img src="/logo.png" class="avatar">
            <div class="ovni-message assistant">
              <div class="typing-indicator">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
              </div>
            </div>
          `;
          container.appendChild(wrapper);
          container.scrollTop = container.scrollHeight;
        }

        hideTyping() {
          const typing = document.getElementById('typingIndicator');
          if (typing) typing.remove();
        }

        setLoading(loading) {
          this.isLoading = loading;
          const send = document.getElementById('ovniSend');
          const input = document.getElementById('ovniInput');
          send.disabled = loading;
        }

        async sendMessage() {
          const input = document.getElementById('ovniInput');
          const content = input.value.trim();
          if (!content || this.isLoading) return;
          input.value = '';
          this.addMessage(content, 'user');
          this.showTyping();
          this.setLoading(true);
          try {
            const res = await fetch(`${this.apiUrl}/api/chat/invoke`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-client-id': this.clientId
              },
              body: JSON.stringify({
                agentId: this.agentId,
                clientId: this.clientId,
                message: content,
                threadId: this.threadId,
              }),
            });
            const data = await res.json();
            this.hideTyping();
            if (data.success) {
              this.threadId = data.data.threadId;
              localStorage.setItem('ovni_thread_' + this.agentId, this.threadId);
              await this.addSequentialMessages(data.data.response);
            } else {
              this.addMessage('Lo siento, hubo un error. Intenta de nuevo.', 'assistant');
            }
          } catch (err) {
            this.hideTyping();
            this.addMessage('Error de conexión con el servidor.', 'assistant');
          }
          this.setLoading(false);
          input.focus();
        }
      }

      // Inicializar el widget con la config pasada
      window.ovniChat = new OvniChatWidget(config);
    }
  };
})();
