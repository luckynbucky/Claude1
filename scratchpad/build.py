#!/usr/bin/env python3
"""Build the NCA-AIIO study guide HTML from screenshots + curated notes."""
import base64
import os
import textwrap
from pathlib import Path

ROOT = Path("/home/user/Claude1/scratchpad")
IMG_DIR = ROOT
OUT = ROOT / "study_guide.html"

def img(n):
    p = IMG_DIR / f"img{n:02d}.jpg"
    b64 = base64.b64encode(p.read_bytes()).decode()
    return f"data:image/jpeg;base64,{b64}"

# section: 'essential' | 'infra' | 'ops'
# Each card: (topic code, title, bullets[], image_numbers[])
CARDS = [
    # ===== Essential AI Knowledge (38%) =====
    ("essential", "1.8", "H100 Hopper Architecture — the LLM engine",
     ["80 billion transistors on a single die.",
      "900 GB/s scalable NVLink interconnects for GPU-to-GPU bandwidth.",
      "Multi-Instance GPU (MIG) partitions one physical GPU into isolated slices for better utilization.",
      "Confidential computing on-die for security-sensitive workloads."], [6]),

    ("essential", "1.8", "Why the name Hopper?",
     ["Grace Hopper — US Navy Rear Admiral, mathematician, computer scientist.",
      "One of the first programmers of the Harvard Mark I; invented one of the first linkers.",
      "NVIDIA names GPU architectures after computing pioneers (Hopper, Ada Lovelace, Blackwell)."], [7]),

    ("essential", "1.8", "NVIDIA Grace CPU — the AI/HPC core",
     ["Grace pairs with H100 GPUs to power: LLMs, Recommender Systems, Vector DBs, GNNs.",
      "Built on Arm architecture with NVIDIA's own memory subsystem.",
      "Designed for HPC apps, cloud, and hyperscale data centers.",
      "Energy-efficient, highly scalable, and supports large amounts of memory & bandwidth."], [8, 9]),

    ("essential", "1.8", "Grace Hopper Superchip (GH200)",
     ["Combines one Grace CPU with one H100 GPU on the same board.",
      "NVLink chip-to-chip (C2C) interconnect provides coherent, high-bandwidth data transfer between CPU and GPU.",
      "Large unified memory model — CPU and GPU share the same address space.",
      "Targets: Recommender systems, scientific computing, energy-efficient CPU+GPU workloads."], [10]),

    ("essential", "1.8", "Grace Blackwell / Blackwell Ultra Superchip",
     ["Grace CPU + TWO Blackwell (or Blackwell Ultra) GPUs on one board.",
      "NVLink C2C gives coherent access to unified memory across the chip.",
      "Unified memory supports trillion-parameter LLMs, multimodal transformers, large-scale simulations, and 3D generative models.",
      "Targets: Generative AI, scientific computing, energy-efficient CPU+GPU."], [11]),

    ("essential", "1.5 / 1.6", "Data Center GPUs by use case — Blackwell, Hopper, Ada Lovelace",
     ["Deep Learning Training & Data Analytics → B200, GH200, H100, L40S.",
      "Deep Learning Inference → B200, GH200, H100, L40S, L40, L4.",
      "High-Performance Computing & AI → B200, GH200, H100, L40S.",
      "Omniverse / Render Farms → L40S, L40, L4.",
      "Virtual Workstation → L40, L4. Virtual Desktop (VDI) → L4. AI Video → L40S, L4. Far Edge → L4."], [12]),

    # ===== AI Infrastructure (40%) =====

    # DGX & BasePOD
    ("infra", "2.5", "NVIDIA DGX BasePOD — five component overview",
     ["Reference architecture for an AI cluster, built from FIVE things you must know:",
      "1) DGX systems  2) Networking systems  3) Base Command software  4) AI Enterprise software  5) Partner storage."], [2]),

    ("infra", "2.5", "DGX BasePOD — the full stack",
     ["Industry apps (NLP, fraud detection, healthcare) sit on top of NVIDIA AI Enterprise.",
      "AI workflow management + MLOps optional layer.",
      "Base Command orchestrates DGX systems + Storage (required but separate/partner) + NVIDIA Networking.",
      "Green = NVIDIA; Grey = Optional; Blue bar = Required but separate."], [3, 4]),

    ("infra", "2.1", "DGX B200 vs DGX H200 / H100 — spec snapshot",
     ["DGX B200: 8× Blackwell GPUs, 1,440 GB total GPU memory, 2× Xeon Platinum 8570 (112 cores).",
      "DGX H200: 8× Hopper GPUs, 1,128 GB GPU memory. DGX H100: 640 GB GPU memory.",
      "All use 4× OSFP + 8× ConnectX-7 VPI ports, up to 400 Gb/s InfiniBand or Ethernet.",
      "H100/H200 add 2× QSFP112 ConnectX-7; B200 adds 2× QSFP112 BlueField-3 DPUs."], [5]),

    ("infra", "2.1 / 2.5", "DGX H100 — the gold standard multi-GPU system",
     ["8× H100 Tensor Core GPUs, connected by NVSwitch for full inter-GPU bandwidth.",
      "10× ConnectX-7 network interfaces for scale-out fabric.",
      "2 TB system memory, 30 TB of NVMe SSDs.",
      "Dual Intel Xeon Platinum 8480C CPUs. Delivers 32 quadrillion AI operations per second."], [17]),

    ("infra", "2.1", "DGX H100 physical layout — what's inside",
     ["Bezel + front console board, fan modules, self-encrypting NVMe drives.",
      "8× H100 GPUs on the GPU tray; 4× 4th-generation NVLink switches on top.",
      "Quad ConnectX-7 network modules, motherboard tray, power supplies, front cage.",
      "Know the exploded-view components — recognition question territory."], [18]),

    ("infra", "1.6 / 2.5", "DGX Systems family — pick the right one",
     ["DGX H100 / H200 — AI supercomputer for large generative AI and transformer workloads.",
      "DGX B200 — unified system built with Blackwell for every stage: training → fine-tuning → inference.",
      "DGX B300 — Blackwell Ultra for large generative AI and transformer training/inference.",
      "DGX GB200 — leadership-class LIQUID-COOLED with Grace Blackwell Superchips for leading-edge foundational training.",
      "DGX GB300 — most advanced liquid-cooled system with Grace Blackwell Ultra for training + post-training + test-time inference."], [19]),

    ("infra", "2.1 / 2.5", "GB300 NVL72 — built for AI reasoning",
     ["36 NVIDIA Grace CPUs + 72 Blackwell Ultra GPUs in a single rack.",
      "5th-generation NVLink. NVLink Bandwidth: 130 TB/s.",
      "GPU memory: 20 TB with up to 576 TB/s bandwidth.",
      "CPU memory: 17 TB LPDDR5X at 14 TB/s."], [20]),

    ("infra", "2.1", "NVIDIA RTX PRO Server — Blackwell for AI + visual computing",
     ["RTX PRO 6000 Blackwell Server Edition GPU.",
      "24,064 CUDA parallel processing cores.",
      "752 NVIDIA Tensor Cores (5th generation).",
      "188 NVIDIA RT Cores (4th generation)."], [21]),

    # Scaling
    ("infra", "2.2", "Scale-Up vs Scale-Out — know the difference",
     ["Scale-UP (Multi-GPU): add more GPUs to a single node. Requires high-speed interconnect between GPUs. Distributes data across GPUs. Load balances between GPUs. WEAK fault tolerance.",
      "Scale-OUT (Multi-Node): add more nodes to the cluster. Each node has own processing + high-speed interconnect. Distributes across nodes. Load balances across nodes. ROBUST fault tolerance.",
      "Exam trap: fault tolerance — weak for scale-up, robust for scale-out."], [13]),

    ("infra", "2.2", "Multi-GPU Systems — the PCIe bottleneck",
     ["Multi-GPU systems answer the need for growth in computing capacity.",
      "They require high-bandwidth inter-GPU communication.",
      "Bandwidth provided by PCIe has proved to be a bottleneck — this is WHY NVLink exists."], [14]),

    ("infra", "2.9", "GPU-to-GPU — NVLink Chip-to-Chip (C2C)",
     ["NVLink-C2C interconnect lets GPUs communicate at incredibly high speeds.",
      "Multi-GPU systems achieve near-linear performance scaling using NVLink."], [15]),

    ("infra", "2.9", "All-to-All GPU comms — NVSwitch Fabric",
     ["With AI + HPC workloads, all-to-all GPU communication is required.",
      "NVIDIA NVSwitch enables direct comms between ANY GPU pair without bottlenecks.",
      "Each GPU uses NVLink interconnects to communicate with all NVSwitch fabrics.",
      "Twelve NVLinks form the building blocks of each NVSwitch connection."], [16]),

    # DPU
    ("infra", "2.10", "Data Center Transformation with NVIDIA DPU",
     ["OFFLOAD — take over infrastructure tasks from the server CPU so more CPU power runs applications.",
      "ACCELERATE — run infrastructure functions faster than the CPU using hardware acceleration in the DPU silicon.",
      "ISOLATE — move key data + control plane functions to a separate domain on the DPU (relieves CPU AND protects if CPU/software is compromised).",
      "Memorize the three verbs: Offload / Accelerate / Isolate."], [22]),

    ("infra", "2.10", "The DPU — software-defined infrastructure-on-a-chip",
     ["NVIDIA DPU has Arm cores + accelerators.",
      "Runs four workloads: Infrastructure Management, Software-Defined Security, Software-Defined Storage, Software-Defined Networking.",
      "Plus a hardware Acceleration Engine."], [23]),

    ("infra", "2.10", "DPU vs traditional NIC — the visual comparison",
     ["Traditional server: CPU runs VMs + Containers AND infra mgmt/security/storage/networking; a plain NIC just has an acceleration engine.",
      "With DPU: infrastructure workloads move OFF the CPU and INTO the DPU — CPU regains capacity for more VMs/containers.",
      "The DPU box in the picture always includes: Arm cores, Infra Mgmt, SD Security, SD Storage, SD Networking, Acceleration Engine."], [24, 25]),

    ("infra", "2.10", "NVIDIA BlueField-3 — 400 Gbps infrastructure compute",
     ["400 GB networking: RDMA/RoCE, SDN/NFV accelerations, precision timing.",
      "Programmable engines: 16× 64-bit Arm A78 cores + 16 hyperthreaded DPA cores + accelerated pipeline.",
      "Zero-Trust Security: platform security, crypto accelerations, zero-trust infrastructure.",
      "Composable Storage: NVMe-oF, NVMe/TCP, storage disaggregation, storage encryption."], [26]),

    ("infra", "1.1 / 2.10", "NVIDIA DOCA — the SDK for BlueField DPUs",
     ["Unified software framework for BlueField DPUs.",
      "Enables offload / accelerate / isolate for infrastructure processing.",
      "Supports hyperscale, enterprise, supercomputing, and hyperconverged infrastructure.",
      "Six capability areas: Orchestration, Security, Networking, Storage, Management, Telemetry — plus Acceleration Libraries."], [27]),

    # Certified systems
    ("infra", "2.5", "NVIDIA-Certified Systems — design options",
     ["Simplifies deployment of accelerated computing at scale.",
      "Server side: Server GPUs + SmartNICs & DPUs + Leading Partner Servers.",
      "Client side: Workstation GPUs + Leading Partner Laptops and Desktops."], [28]),

    ("infra", "2.5", "NVIDIA-Certified Systems — what certification validates",
     ["The certification validates the best baseline configuration for FOUR things:",
      "Performance, Manageability, Scalability, Security.",
      "Memorize the four — likely an exam question."], [29]),

    # Networking
    ("infra", "2.7", "AI Data Center Networks — Compute Network (East-West)",
     ["AI DCs need dedicated networks because more compute = faster comms required.",
      "The Compute Network carries GPU-to-GPU traffic across nodes — east-west."], [30]),

    ("infra", "2.7", "AI Data Center Networks — In-Band Management",
     ["The In-Band Management Network handles admin, orchestration, and access traffic.",
      "Separate from the compute fabric so control traffic doesn't compete with training."], [31]),

    ("infra", "2.7", "Networking requirements for AI workloads",
     ["Five dimensions to reason about:",
      "1) Network topology  2) Bandwidth and latency  3) Network protocols  4) Data transferring techniques  5) Management methods."], [32]),

    ("infra", "2.7 / 2.8", "AI workloads require an AI Fabric — N-S vs E-W",
     ["Control/User Access Network (North-South) — loosely-coupled apps, TCP, low bandwidth, high jitter tolerance, oversubscribed topologies, heterogeneous traffic.",
      "AI Fabric (East-West) — TIGHTLY-coupled processes, RDMA (high bandwidth), LOW jitter tolerance, NONBLOCKING topologies, bursty capacity with predictive performance.",
      "For AI, you want the right-hand column: RDMA, low jitter, nonblocking, predictive."], [33]),

    ("infra", "2.4 / 2.7", "AI Factories vs AI Cloud — two networking paradigms",
     ["AI Factories: single or few workloads, EXTREMELY LARGE AI models → NVLink and InfiniBand AI Fabric.",
      "AI Cloud: hyperscale, MULTI-TENANT, VARIETY of workloads, less-complex/smaller/lower-scale jobs → Ethernet Network.",
      "Which fabric an environment uses tells you what it is."], [35, 36]),

    ("infra", "2.8 / 2.9", "What is InfiniBand?",
     ["A networking technology with HIGH throughput, LOW latency, LOW processing overhead.",
      "Connects more than 50% of the TOP500 supercomputing list.",
      "Spec maintained by the InfiniBand Trade Association (IBTA).",
      "Common speeds: 400/800 Gbps between server/compute, switch, and storage."], [37]),

    ("infra", "2.8", "CPU Offloads and RDMA — Remote Direct Memory Access",
     ["RDMA supports data transfer with MINIMAL CPU intervention.",
      "InfiniBand HCAs include hardware offloading — faster data movement with less CPU overhead.",
      "OS bypass = fastest access to remote data.",
      "Supports message passing, sockets, and storage protocols; works on all major OSes."], [38]),

    ("infra", "2.8", "GPUDirect RDMA — GPU-to-GPU across servers",
     ["GPUDirect RDMA saves full copy operations.",
      "Reduces PCI transactions and CPU usage.",
      "Improves end-to-end latency between GPUs on different servers."], [39]),

    ("infra", "2.9", "NVIDIA Networking Portfolio — the full picture",
     ["Scale-Up (Compute Domain fabric): NVLink Switch — inside a system/rack.",
      "Scale-Out (Compute, East-West): Quantum-X800 InfiniBand switch + SuperNIC (IB/Ethernet) + Spectrum-X Ethernet AI switch.",
      "North-South (Secure User Access, Storage, Management): BlueField-3 DPU."], [40, 41]),

    ("infra", "2.9", "NVIDIA Spectrum-X Ethernet — first Ethernet platform for AI",
     ["Combines specialized high-performance architecture with standard Ethernet connectivity.",
      "Software stack: Cumulus, NetQ, NVIDIA Air, RCP, CloudAI, DOCA, SAI/SPSDK.",
      "SuperNICs + Spectrum-X switch, tightly coupled with BlueField-3 DPU.",
      "NCCL-optimized RoCE, adaptive routing, congestion control, extremely low latency."], [42]),

    ("infra", "2.9", "Quantum-X800 InfiniBand + ConnectX-8 SuperNIC",
     ["Quantum-X800 Q3400-RA switch: 144 ports of 800 Gb/s per port; 4th-gen NVIDIA SHARP; adaptive routing, congestion control, advanced power mgmt.",
      "ConnectX-8 SuperNIC: 800 Gb/s end-to-end; supports BOTH InfiniBand and Ethernet; PCIe Gen6 (up to 48 lanes)."], [43]),

    # Storage
    ("infra", "2.5 / 2.6", "Storage — Network File Systems (NFS)",
     ["Most common shared storage protocol.",
      "NFS developed by Sun Microsystems in 1984.",
      "Files stored as blocks, accessed via POSIX semantics (open, read, seek, close).",
      "Filesystem appears as local to every client; reliable with decent performance and simple interface.",
      "Enterprise features: snapshots, replication, performance-profiling tools (Dell EMC, NetApp, Pure Storage)."], [44]),

    ("infra", "2.6", "Storage — Parallel / Distributed File Systems",
     ["Spread data across multiple storage controller devices.",
      "Appear as a local file system to the client.",
      "Better performance for LARGE, PARALLEL, or SHARED file I/O.",
      "Use custom clients for max performance; often support InfiniBand.",
      "Examples: DDN, WEKA.io, IBM Spectrum Scale."], [45]),

    ("infra", "2.6", "Storage — Object Storage",
     ["Scales more easily from TB to PB than shared filesystems.",
      "NO directory structure — files are blobs/buckets referenced by keys.",
      "Accessed via REST API.",
      "High data protection through replication.",
      "Traditionally used for the largest cloud data repositories (S3, Google Cloud Storage, Azure Blob, OpenStack)."], [46]),

    # Facility + Cert
    ("infra", "2.6", "Planning a Data Center Deployment",
     ["A well-planned deployment aligns FIVE roles:",
      "Data center operations & facilities, IT operations, NOC support, the application owner, and Network operations.",
      "Resource constraints in one domain affect planning, ops, personnel, and budgets in the others — plan across all five."], [47]),

    ("infra", "2.3", "Modern energy-efficient supercomputers — the four levers",
     ["GPU compute vs CPU: 1/47th the rack space, 93% lower energy costs for AI models.",
      "Software: 2.5× perf gain, 20% estimated energy savings on the SAME hardware.",
      "Networking: 30% CPU load reduction, 50% perf improvement, 40% lower power vs previous generation.",
      "SOTA cooling optimizes data center designs and server deployments."], [48]),
]

SECTION_META = {
    "essential": {
        "title": "Essential AI Knowledge",
        "weight": "38%",
        "blurb": "NVIDIA software stack · AI/ML/DL · GPU vs CPU architecture · training vs inference · lifecycle.",
        "hex": "#3B4A5B",
        "num": "01",
    },
    "infra": {
        "title": "AI Infrastructure",
        "weight": "40%",
        "blurb": "Hardware · scaling · power & cooling · on-prem vs cloud · cluster · facility · networking · protocols · DPUs · storage.",
        "hex": "#2E6B4A",
        "num": "02",
    },
    "ops": {
        "title": "AI Operations",
        "weight": "22%",
        "blurb": "DC management & monitoring · cluster orchestration & scheduling · GPU monitoring · virtualization.",
        "hex": "#A66A2C",
        "num": "03",
    },
}

# Ops section — no direct screenshots in the set; give a compact study card instead
OPS_STUDY = [
    ("3.1", "Data center management & monitoring",
     ["NVIDIA Base Command — full-stack management for AI clusters (scheduling, dataset mgmt, user access).",
      "Baseboard Management Controller (BMC) — out-of-band mgmt via IPMI/Redfish; power, thermals, remote console.",
      "Out-of-Band Management Networks — dedicated network for lights-out control, isolated from data traffic."]),
    ("3.2", "Cluster orchestration & job scheduling",
     ["Kubernetes — container orchestration; NVIDIA GPU Operator handles drivers/toolkit/DCGM install inside K8s.",
      "Slurm — the traditional HPC workload manager; batch jobs, partitions, gang scheduling for MPI/multi-node.",
      "Containers (Docker) — package models + deps for portable, reproducible runs.",
      "Base Command Platform sits above these for end-to-end AI workflow orchestration."]),
    ("3.3", "GPU monitoring — what to measure",
     ["NVIDIA DCGM (Data Center GPU Manager) — the standard tool: exports metrics, runs diagnostics, integrates with Prometheus.",
      "Key metrics: GPU utilization %, memory used/free, temperature, power draw, ECC errors, NVLink throughput, PCIe throughput.",
      "'6 Reasons for Low GPU Utilization' — common causes: CPU bottleneck, small batch size, I/O-bound data pipeline, single-GPU code in multi-GPU box, wrong precision, misconfigured MIG."]),
    ("3.4", "Virtualizing accelerated infrastructure",
     ["NVIDIA MIG (Multi-Instance GPU) — hardware-partition one A100/H100 into up to 7 isolated GPU instances with dedicated memory + compute.",
      "vGPU — time-slice a GPU across multiple VMs (VDI/graphics; different mechanism from MIG).",
      "Passthrough — assign a whole GPU to one VM (max perf, no sharing).",
      "Use MIG when you need HARDWARE isolation between tenants on a single GPU."]),
]

# Build HTML
html_parts = []
html_parts.append('''<title>NCA-AIIO Visual Study Guide</title>
<style>
  :root {
    --bg: #F7F7F2;
    --surface: #FFFFFF;
    --surface-alt: #F0F0E8;
    --ink: #14161A;
    --ink-soft: #2B2F36;
    --muted: #5E6570;
    --border: #E3E3DA;
    --accent: #76B900;
    --accent-ink: #14161A;
    --shadow: 0 1px 2px rgba(20,22,26,.04), 0 8px 24px -12px rgba(20,22,26,.08);
    --radius: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0F1114;
      --surface: #171A1E;
      --surface-alt: #1E2228;
      --ink: #EAEAE3;
      --ink-soft: #C4C6BE;
      --muted: #8B9199;
      --border: #262A30;
      --accent: #92DA1E;
      --accent-ink: #0F1114;
      --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
    }
  }
  :root[data-theme="light"] {
    --bg: #F7F7F2; --surface: #FFFFFF; --surface-alt: #F0F0E8;
    --ink: #14161A; --ink-soft: #2B2F36; --muted: #5E6570;
    --border: #E3E3DA; --accent: #76B900; --accent-ink: #14161A;
    --shadow: 0 1px 2px rgba(20,22,26,.04), 0 8px 24px -12px rgba(20,22,26,.08);
  }
  :root[data-theme="dark"] {
    --bg: #0F1114; --surface: #171A1E; --surface-alt: #1E2228;
    --ink: #EAEAE3; --ink-soft: #C4C6BE; --muted: #8B9199;
    --border: #262A30; --accent: #92DA1E; --accent-ink: #0F1114;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .mono { font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace; }

  /* Top rail */
  header.rail {
    position: sticky; top: 0; z-index: 20;
    background: color-mix(in oklab, var(--bg) 88%, transparent);
    backdrop-filter: saturate(1.1) blur(10px);
    -webkit-backdrop-filter: saturate(1.1) blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .rail-inner {
    max-width: 1200px; margin: 0 auto; padding: 12px 24px;
    display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
  }
  .brand {
    display: flex; align-items: baseline; gap: 10px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    letter-spacing: 0.02em;
  }
  .brand-dot {
    width: 10px; height: 10px; border-radius: 2px;
    background: var(--accent); display: inline-block;
    transform: translateY(1px);
  }
  .brand-name {
    font-weight: 700; font-size: 13px; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--ink);
  }
  .brand-sub {
    font-size: 12px; color: var(--muted);
  }
  nav.jumps { display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
  nav.jumps a {
    text-decoration: none; color: var(--ink-soft);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 8px 12px; border-radius: 6px; border: 1px solid transparent;
    display: inline-flex; align-items: center; gap: 8px;
  }
  nav.jumps a:hover, nav.jumps a:focus-visible {
    background: var(--surface-alt); border-color: var(--border); outline: none;
  }
  nav.jumps a .w {
    font-size: 10.5px; color: var(--muted);
    padding: 2px 6px; border: 1px solid var(--border); border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }
  .theme-toggle {
    background: transparent; border: 1px solid var(--border);
    color: var(--ink-soft); border-radius: 6px;
    font-family: ui-monospace, Menlo, monospace; font-size: 11px;
    padding: 6px 10px; cursor: pointer; letter-spacing: 0.08em;
  }
  .theme-toggle:hover { background: var(--surface-alt); }

  /* Hero */
  .hero {
    max-width: 1200px; margin: 0 auto; padding: 48px 24px 24px;
  }
  .hero-eyebrow {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 20px;
    display: flex; align-items: center; gap: 12px;
  }
  .hero-eyebrow::before {
    content: ""; width: 22px; height: 1px; background: var(--accent);
  }
  .hero h1 {
    font-size: clamp(32px, 4.5vw, 54px);
    line-height: 1.02; margin: 0 0 16px;
    letter-spacing: -0.02em; font-weight: 700;
    text-wrap: balance;
    color: var(--ink);
  }
  .hero h1 em {
    font-style: normal; color: var(--accent);
    font-weight: 700;
  }
  .hero p.lede {
    font-size: 17px; max-width: 62ch; color: var(--ink-soft);
    margin: 0 0 32px; line-height: 1.55;
  }
  .weights {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; margin-top: 16px;
  }
  .weight-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 20px;
    display: flex; flex-direction: column; gap: 6px;
    box-shadow: var(--shadow);
    position: relative; overflow: hidden;
  }
  .weight-card::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; background: var(--tag);
  }
  .weight-card .num {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px; letter-spacing: 0.14em; color: var(--muted);
    text-transform: uppercase;
  }
  .weight-card .title {
    font-size: 17px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
  }
  .weight-card .weight {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 26px; font-weight: 700; color: var(--tag);
    font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  }
  .weight-card .blurb {
    font-size: 13px; color: var(--muted); margin-top: 4px;
  }
  @media (max-width: 820px) {
    .weights { grid-template-columns: 1fr; }
  }

  /* Section */
  section.chapter {
    max-width: 1200px; margin: 0 auto; padding: 56px 24px 24px;
    scroll-margin-top: 80px;
  }
  .chapter-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 24px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border); margin-bottom: 32px;
    flex-wrap: wrap;
  }
  .chapter-head .left { display: flex; flex-direction: column; gap: 6px; }
  .chapter-head .num {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px; letter-spacing: 0.16em; color: var(--tag);
    text-transform: uppercase;
    display: flex; align-items: center; gap: 10px;
  }
  .chapter-head .num::before {
    content: ""; width: 8px; height: 8px; background: var(--tag); border-radius: 50%;
  }
  .chapter-head h2 {
    margin: 0; font-size: clamp(26px, 3.4vw, 38px);
    letter-spacing: -0.02em; font-weight: 700;
    line-height: 1.1;
  }
  .chapter-head .weight-pill {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px; letter-spacing: 0.08em;
    padding: 6px 12px; border-radius: 999px;
    background: var(--tag); color: white;
    font-variant-numeric: tabular-nums; font-weight: 600;
  }
  .chapter-head .blurb {
    color: var(--muted); font-size: 14px; max-width: 60ch;
  }

  /* Card grid */
  .cards {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;
  }
  @media (max-width: 900px) {
    .cards { grid-template-columns: 1fr; }
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    box-shadow: var(--shadow);
    display: flex; flex-direction: column;
    position: relative;
  }
  .card::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0;
    height: 2px; background: var(--tag);
  }
  .card-head { padding: 18px 20px 8px; }
  .card-code {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px; letter-spacing: 0.1em; color: var(--muted);
    text-transform: uppercase; margin-bottom: 8px;
  }
  .card-code .dot {
    width: 6px; height: 6px; background: var(--tag); border-radius: 50%;
  }
  .card h3 {
    margin: 0; font-size: 18px; font-weight: 600;
    letter-spacing: -0.01em; line-height: 1.28;
    color: var(--ink); text-wrap: balance;
  }
  .bullets {
    list-style: none; padding: 4px 20px 16px; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
    font-size: 14px; color: var(--ink-soft); line-height: 1.5;
  }
  .bullets li {
    padding-left: 18px; position: relative;
  }
  .bullets li::before {
    content: ""; position: absolute; left: 0; top: 8px;
    width: 8px; height: 2px; background: var(--tag);
    border-radius: 1px;
  }
  .shots {
    display: flex; flex-direction: column; gap: 1px;
    background: var(--border); margin-top: auto;
    border-top: 1px solid var(--border);
  }
  .shot {
    background: var(--surface-alt);
    display: block;
  }
  .shot img {
    width: 100%; height: auto; display: block;
    background: #000;
  }

  /* Ops study cards - text-only */
  .ops-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px;
    box-shadow: var(--shadow);
    position: relative;
  }
  .ops-card::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0;
    height: 2px; background: var(--tag);
  }
  .ops-note {
    background: var(--surface-alt); border: 1px dashed var(--border);
    border-radius: var(--radius); padding: 14px 18px;
    font-size: 13px; color: var(--muted);
    margin-bottom: 24px; line-height: 1.55;
  }

  footer.foot {
    max-width: 1200px; margin: 0 auto; padding: 56px 24px 40px;
    color: var(--muted); font-size: 12px;
    border-top: 1px solid var(--border); margin-top: 40px;
    display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  }
  footer.foot .mono { letter-spacing: 0.06em; }

  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  ::selection { background: color-mix(in oklab, var(--accent) 40%, transparent); color: var(--ink); }

  @media (prefers-reduced-motion: no-preference) {
    html { scroll-behavior: smooth; }
  }
</style>
''')

# Header
html_parts.append('''
<header class="rail">
  <div class="rail-inner">
    <div class="brand">
      <span class="brand-dot" aria-hidden="true"></span>
      <span class="brand-name">NCA-AIIO</span>
      <span class="brand-sub">Visual Study Guide</span>
    </div>
    <nav class="jumps" aria-label="Sections">
      <a href="#essential">Essential AI <span class="w">38%</span></a>
      <a href="#infra">Infrastructure <span class="w">40%</span></a>
      <a href="#ops">Operations <span class="w">22%</span></a>
    </nav>
    <button class="theme-toggle" id="themeBtn" aria-label="Toggle theme">Theme</button>
  </div>
</header>
''')

# Hero
html_parts.append('''
<div class="hero">
  <div class="hero-eyebrow">NVIDIA-Certified Associate · AI Infrastructure &amp; Operations</div>
  <h1>Everything on the exam, <em>ranked and pictured</em> the way you actually study.</h1>
  <p class="lede">Your screenshots from the course video, sorted against the official three-section outline. Each card gives you the exam topic code, three-to-five things worth remembering, then the slide itself &mdash; sized to actually read from.</p>
  <div class="weights">
''')

for key in ["essential", "infra", "ops"]:
    s = SECTION_META[key]
    html_parts.append(f'''
    <a class="weight-card" style="--tag: {s['hex']}; text-decoration: none; color: inherit;" href="#{key}">
      <span class="num">Section {s['num']} · Exam weight</span>
      <span class="title">{s['title']}</span>
      <span class="weight">{s['weight']}</span>
      <span class="blurb">{s['blurb']}</span>
    </a>
    ''')

html_parts.append('  </div>\n</div>\n')

# Cards per section
for key in ["essential", "infra"]:
    s = SECTION_META[key]
    html_parts.append(f'''
<section class="chapter" id="{key}" style="--tag: {s['hex']};">
  <div class="chapter-head">
    <div class="left">
      <div class="num">Section {s['num']}</div>
      <h2>{s['title']}</h2>
      <div class="blurb">{s['blurb']}</div>
    </div>
    <div class="weight-pill">{s['weight']}</div>
  </div>
  <div class="cards">
''')
    for section, code, title, bullets, imgs in CARDS:
        if section != key: continue
        html_parts.append(f'''    <article class="card">
      <div class="card-head">
        <div class="card-code"><span class="dot"></span>Topic {code}</div>
        <h3>{title}</h3>
      </div>
      <ul class="bullets">
''')
        for b in bullets:
            html_parts.append(f'        <li>{b}</li>\n')
        html_parts.append('      </ul>\n      <div class="shots">\n')
        for n in imgs:
            html_parts.append(f'        <div class="shot"><img loading="lazy" alt="Slide for topic {code}" src="{img(n)}"></div>\n')
        html_parts.append('      </div>\n    </article>\n')
    html_parts.append('  </div>\n</section>\n')

# Ops section - text only with note about screenshots
s = SECTION_META["ops"]
html_parts.append(f'''
<section class="chapter" id="ops" style="--tag: {s['hex']};">
  <div class="chapter-head">
    <div class="left">
      <div class="num">Section {s['num']}</div>
      <h2>{s['title']}</h2>
      <div class="blurb">{s['blurb']}</div>
    </div>
    <div class="weight-pill">{s['weight']}</div>
  </div>
  <div class="ops-note">
    <strong>Heads up:</strong> your uploaded screenshots didn't cover this section &mdash; the outline's Ops topics (Base Command, DCGM, MIG, Slurm, Kubernetes, BMC/out-of-band) aren't in the slides you sent. Cards below are a compact study card built from the outline + suggested reading list so you don't skip 22% of the exam.
  </div>
  <div class="cards">
''')
for code, title, bullets in OPS_STUDY:
    html_parts.append(f'''    <article class="ops-card">
      <div class="card-code" style="margin-bottom: 8px;"><span class="dot" style="display:inline-block;width:6px;height:6px;background:var(--tag);border-radius:50%;margin-right:8px;"></span>Topic {code}</div>
      <h3 style="margin:0 0 10px;font-size:18px;font-weight:600;letter-spacing:-0.01em;color:var(--ink);">{title}</h3>
      <ul class="bullets" style="padding:0;">
''')
    for b in bullets:
        html_parts.append(f'        <li>{b}</li>\n')
    html_parts.append('      </ul>\n    </article>\n')
html_parts.append('  </div>\n</section>\n')

# Footer
html_parts.append('''
<footer class="foot">
  <div>
    <div class="mono" style="text-transform:uppercase; font-size:11px; letter-spacing:0.14em; color:var(--ink); margin-bottom:6px;">Study strategy</div>
    Weight your prep to the exam: 40% of your time on Infrastructure, 38% on Essential AI, 22% on Operations. Recognize the diagrams &mdash; NVIDIA reuses them across their material.
  </div>
  <div class="mono">Built from your slide captures · Outline v.4694224 JAN26</div>
</footer>

<script>
  (function() {
    const btn = document.getElementById("themeBtn");
    const root = document.documentElement;
    const saved = localStorage.getItem("aiio-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
    btn.addEventListener("click", () => {
      const now = root.getAttribute("data-theme");
      const media = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const cur = now || media;
      const next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("aiio-theme", next);
    });
  })();
</script>
''')

OUT.write_text("".join(html_parts))
size_mb = OUT.stat().st_size / (1024 * 1024)
print(f"Wrote {OUT} ({size_mb:.2f} MB)")
