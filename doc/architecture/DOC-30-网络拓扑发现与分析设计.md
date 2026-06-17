# DOC-30：网络拓扑发现与分析设计

> **版本**：v1.0  
> **最后更新**：2026-06-16  
> **状态**：初稿  
> **依赖**：DOC-01（系统架构规格书）、DOC-02（模块分解设计）

---

## 目录

1. [模块职责](#1-模块职责)
2. [发现协议与信息采集](#2-发现协议与信息采集)
3. [拓扑发现算法与流程](#3-拓扑发现算法与流程)
4. [拓扑图数据模型与接口](#4-拓扑图数据模型与接口)
5. [可视化展现规范](#5-可视化展现规范)
6. [异常检测与告警](#6-异常检测与告警)

---

## 1. 模块职责

网络拓扑管理模块（`network`）负责自动发现大型园区网络设备（交换机、路由器、防火墙、AP）及其物理与逻辑连接，生成动态拓扑图。对于 2000-5000 台终端的大型园区，该模块能够识别 VLAN 分区隔离、连通性异常、链路丢包以及流量过载，为 AI 诊断网络故障提供拓扑上下文。

---

## 2. 发现协议与信息采集

### 2.1 SNMP 采集指标

系统利用 Zabbix SNMP 模板，或由 Celery Worker 直接通过 PySNMP 轮询网络设备。主要采集以下 MIB 组：

| MIB 组/对象 | OID | 说明 | 采集频率 |
|-------------|-----|------|---------|
| **System Group** | `.1.3.6.1.2.1.1` | 设备名称、描述、运行时间、位置 | 3600s |
| **Interfaces Group (ifTable)** | `.1.3.6.1.2.1.2.2` | 端口列表、端口类型、MTU、管理/物理状态、速率 | 60s |
| **IP Group (ipNetToMediaTable)** | `.1.3.6.1.2.1.4.22` | ARP 缓存表，用于 IP 到 MAC 映射 | 300s |
| **Bridge MIB (dot1dTpFdbTable)** | `.1.3.6.1.2.1.17.4.3` | MAC 地址转发表 (FDB)，确定物理端口接了什么 MAC | 300s |
| **LLDP MIB (lldpLocalSystemData)** | `.1.3.6.1.4.1.9.9.273` | 本地设备 LLDP 端口及信息 | 300s |
| **LLDP Remote MIB (lldpRemoteSystemsData)** | `.1.3.6.1.4.1.9.9.273.1.2` | 邻居设备名称、MAC、接口及连接关系 | 300s |

---

## 3. 拓扑发现算法与流程

拓扑发现通过**基于种子节点的广度优先遍历算法**，结合 LLDP/CDP 与 Bridge FDB 表混合推导。

```
                       ┌──────────────────────┐
                       │ 种子节点 (如核心交换机)│
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │   SNMP 轮询邻居关系   │
                       │     (LLDP/CDP MIB)   │
                       └──────────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼ (找到邻居交换机)            ▼ (未开启 LLDP 的接入终端)
        ┌──────────────────────┐    ┌──────────────────────┐
        │  加入待发现队列      │    │  通过 Bridge FDB 匹配 │
        │  (广度优先循环)      │    │  MAC 地址到物理端口  │
        └──────────┬───────────┘    └───────────┬──────────┘
                   │                            │
                   ▼                            ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │ 递归直至网络边界      │    │ 绑定资产 (MAC 匹配)  │
        └──────────────────────┘    └──────────────────────┘
```

### 3.1 物理连接推导算法 (Bridge FDB Matching)

当设备不支持 LLDP 时，通过读取交换机 FDB (Forwarding Database) 表与 ARP 表计算端口连接：
1. 从交换机获取 MAC-Port 映射关系：`Port X -> MAC A`。
2. 过滤掉在上行/级联链路端口出现的 MAC（即一个端口对应几十个 MAC，判定为级联口）。
3. 剩下的单一物理端口对应单一 MAC，即为该交换机端口直连设备。
4. 在 `assets` 库中通过 MAC 地址搜索对应终端 IP 进而确认物理拓扑连线。

---

## 4. 拓扑图数据模型与接口

### 4.1 数据模型规格

网络节点与连接关系存储于 `network_devices` 与 `network_edges` 表中。

```sql
-- network_devices 扩充字段
ALTER TABLE network_devices ADD COLUMN role VARCHAR(64); -- 'core','aggregation','access','firewall','router'
ALTER TABLE network_devices ADD COLUMN status VARCHAR(32) DEFAULT 'online';
ALTER TABLE network_devices ADD COLUMN community_string VARCHAR(256); -- 加密存储的 SNMP 读串
```

### 4.2 API 接口定义

*   `GET /api/v1/network/topology`
    *   **权限**：`engineer`
    *   **响应体**：
        ```json
        {
          "nodes": [
            { "id": "dev-01", "label": "Core-Switch-A", "type": "core", "ip": "10.1.0.1", "status": "online" },
            { "id": "dev-02", "label": "Access-Switch-B1", "type": "access", "ip": "10.1.2.1", "status": "online" },
            { "id": "asset-102", "label": "PC-Workstation-102", "type": "endpoint", "ip": "10.1.2.102", "status": "online" }
          ],
          "edges": [
            { "id": "edge-01", "source": "dev-01", "target": "dev-02", "speed_gbps": 10, "type": "trunk", "loss_percent": 0.0 },
            { "id": "edge-02", "source": "dev-02", "target": "asset-102", "speed_gbps": 1, "type": "access", "loss_percent": 0.0 }
          ]
        }
        ```

---

## 5. 可视化展现规范

拓扑图在前端（`system.html` 拓扑看板）使用 HTML5 Canvas (配合 D3-Force 或 Vis.js) 渲染力导向图 (Force-Directed Graph)。

*   **节点样式**：
    *   核心层/汇聚层交换机：使用大型网络图标，状态异常时红色高亮。
    *   终端节点：使用小圆点，以所属 VLAN 颜色区分。
*   **物理链路样式**：
    *   百兆/千兆/万兆链路通过线宽和虚实线区分。
    *   超载链路（带宽利用率 > 80%）使用橙色闪烁表示。
    *   中断链路使用灰色虚线且标注 "Down"。

---

## 6. 异常检测与告警

网络异常告警由监控中心进行准实时判定：

*   **端口翻动 (Port Flapping)**：某一交换机端口在 10 秒内 UP/DOWN 状态变更超过 3 次。自动生成 "Warning" 级网络告警，并推送到工单系统。
*   **ARP 攻击检测**：当同一个 MAC 地址在多个端口的 ARP 缓存表中频繁切换，或有多个 IP 映射到非网关 MAC 上时，触发 "Critical" 级安全告警。
*   **VLAN 间路由不可达**：通过 Agent 端执行的 ICMP Ping 互检测试，发现跨 VLAN 可达性降为 0% 时触发告警，AI 将基于拓扑的公共节点（多层交换机）定位物理瓶颈。
