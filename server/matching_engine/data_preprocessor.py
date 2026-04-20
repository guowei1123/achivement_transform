import re
import jieba
import numpy as np
from typing import Dict, List, Tuple, Any

class DataPreprocessor:
    def __init__(self):
        self.terminology_mapping = self._load_terminology_mapping()
        self.tech_field_keywords = self._load_tech_field_keywords()
        
    def _load_terminology_mapping(self) -> Dict[str, str]:
        return {
            '智能船舶': '智能航运',
            '无人船': '无人船舶',
            '自动驾驶船舶': '智能船舶',
            '绿色船舶': '环保船舶',
            '新能源船舶': '清洁能源船舶',
            '智能港口': '智慧港口',
            '自动化码头': '智能港口',
            '港口物流': '航运物流',
            '船舶制造': '造船',
            '造船': '船舶制造',
            '船舶设计': '船舶工程',
            '船舶维修': '船舶保养',
            '船舶保养': '船舶维修',
            '海洋工程': '海事工程',
            '海事技术': '海洋技术',
            '航运信息化': '智能航运',
            '船舶导航': '航海技术',
            '航海技术': '船舶导航',
            '船舶动力': '推进系统',
            '推进系统': '船舶动力',
            '船舶设备': '船用设备',
            '船用设备': '船舶装备',
            '集装箱': '货运集装箱',
            '散货': '散装货物',
            '油轮': '油品运输船',
            '散货船': '散装货物运输船',
            '集装箱船': '集装箱运输船',
            'LNG船': '液化天然气运输船',
            'LPG船': '液化石油气运输船',
            '邮轮': '客运邮轮',
            '客滚船': '客货滚装船',
            '滚装船': '车辆运输船',
            '多用途船': '多功能船舶',
            '海工装备': '海洋工程装备',
            '深海装备': '深海技术装备',
            '海上风电': '海洋风能',
            '海洋牧场': '海水养殖',
            '船舶能效': '船舶节能',
            '船舶节能': '能效优化',
            '减排技术': '污染控制',
            '压载水处理': '压载水管理',
            '脱硫塔': '废气净化',
            '脱硝系统': '氮氧化物减排',
            '智能航行': '自主航行',
            '自主航行': '智能航行',
            '船舶避碰': '防碰撞系统',
            '防碰撞系统': '船舶避碰',
            '船舶监控': '航行监控',
            '航行监控': '船舶监测',
            '港口自动化': '智能港口',
            '码头自动化': '港口智能化',
            '装卸设备': '港口机械',
            '港口机械': '装卸设备',
            '岸电系统': '港口供电',
            '港口供电': '岸电设施',
            '船舶通信': '海事通信',
            '海事通信': '船舶通信',
            '卫星导航': '全球定位',
            '全球定位': '卫星导航',
            '电子海图': '数字海图',
            '数字海图': '电子海图',
            '船舶管理': '船队管理',
            '船队管理': '船舶运营',
            '航运管理': '船舶调度',
            '船舶调度': '航运管理',
            '货运代理': '物流代理',
            '船舶代理': '航运代理',
            '船务代理': '货运代理',
            '船舶保险': '海事保险',
            '海事保险': '船舶保险',
            '船舶融资': '航运金融',
            '航运金融': '船舶融资',
            '船舶租赁': '光船租赁',
            '光船租赁': '船舶租赁',
            '期租': '定期租赁',
            '程租': '航次租赁',
            '包运': '运输合同',
            '运输合同': '包运协议',
            '船舶检验': '海事检验',
            '海事检验': '船舶检验',
            '船级社': '船舶认证',
            '船舶认证': '船级检验',
            '海事安全': '船舶安全',
            '船舶安全': '海事安全',
            '海上救援': '搜救服务',
            '搜救服务': '海上救援',
            '船舶污染': '海洋污染',
            '海洋污染': '船舶污染',
            '压载水': '船舶压载',
            '船舶压载': '压载水',
            '船舶涂料': '防污涂料',
            '防污涂料': '船舶涂料',
            '螺旋桨': '推进器',
            '推进器': '螺旋桨',
            '舵机': '舵系统',
            '舵系统': '舵机',
            '锚机': '起锚设备',
            '起锚设备': '锚机',
            '绞车': '卷扬机',
            '卷扬机': '绞车',
            '起重机': '吊装设备',
            '吊装设备': '起重机',
            '龙门吊': '门式起重机',
            '门式起重机': '龙门吊',
            '岸桥': '岸边起重机',
            '岸边起重机': '岸桥',
            '堆场机械': '堆场设备',
            '堆场设备': '堆场机械',
            'AGV': '自动导引车',
            '自动导引车': 'AGV',
            '无人集卡': '自动驾驶卡车',
            '自动驾驶卡车': '无人集卡',
            '港口无人车': '自动导引车',
            '智能理货': '自动理货',
            '自动理货': '智能理货',
            '港口EDI': '电子数据交换',
            '电子数据交换': '港口EDI',
            '航运大数据': '船舶数据分析',
            '船舶数据分析': '航运大数据',
            '区块链航运': '分布式账本航运',
            '分布式账本航运': '区块链航运',
            '数字孪生港口': '港口虚拟化',
            '港口虚拟化': '数字孪生港口',
            '智慧航运': '智能航运',
            '绿色航运': '环保航运',
            '低碳航运': '减排航运',
            '减排航运': '低碳航运'
        }
    
    def _load_tech_field_keywords(self) -> Dict[str, List[str]]:
        return {
            '智能船舶': ['智能船舶', '无人船舶', '自主航行', '智能航行', '船舶自动化', '船舶智能化', '智能航运', '自主船舶', '无人船', '自动驾驶船舶'],
            '绿色船舶': ['绿色船舶', '环保船舶', '新能源船舶', '清洁能源船舶', 'LNG船', 'LPG船', '双燃料船', '混合动力船', '电动船舶', '燃料电池船', '风帆助航', '太阳能船舶'],
            '船舶制造': ['船舶制造', '造船', '船舶设计', '船舶工程', '船体设计', '船舶建造', '船舶改装', '船舶修理', '船舶维修', '船舶保养'],
            '船舶动力': ['船舶动力', '推进系统', '螺旋桨', '舵机', '锚机', '绞车', '船舶主机', '辅机', '推进器', '舵系统', '起锚设备', '卷扬机'],
            '港口工程': ['智能港口', '智慧港口', '港口自动化', '码头自动化', '港口机械', '装卸设备', '岸电系统', '港口物流', '港口信息化', '港口智能化'],
            '航运物流': ['航运物流', '货运代理', '船舶代理', '船务代理', '集装箱运输', '散货运输', '油品运输', '化学品运输', '液化气运输', '多用途运输'],
            '海洋工程': ['海洋工程', '海工装备', '深海装备', '海上风电', '海洋牧场', '海洋平台', '深海技术', '海洋资源', '海洋环境', '海洋装备'],
            '船舶设备': ['船舶设备', '船用设备', '船舶装备', '甲板机械', '舱室设备', '导航设备', '通信设备', '安全设备', '消防设备', '救生设备'],
            '海事技术': ['海事技术', '航海技术', '船舶导航', '卫星导航', '电子海图', '数字海图', '船舶通信', '海事通信', '全球定位', 'GPS导航'],
            '船舶管理': ['船舶管理', '船队管理', '航运管理', '船舶调度', '船舶运营', '航运运营', '船务管理', '船舶监控', '航行监控'],
            '航运服务': ['船舶保险', '海事保险', '船舶融资', '航运金融', '船舶租赁', '光船租赁', '期租', '程租', '包运', '运输合同', '船舶检验', '海事检验', '船级社', '船舶认证'],
            '船舶安全': ['船舶安全', '海事安全', '海上救援', '搜救服务', '船舶避碰', '防碰撞系统', '船舶污染', '海洋污染', '压载水', '船舶涂料', '防污涂料'],
            '港口运营': ['港口运营', '港口管理', '堆场管理', '理货服务', '智能理货', '自动理货', '港口EDI', '电子数据交换', '港口大数据', '港口区块链'],
            '航运信息化': ['航运信息化', '船舶信息化', '智能航运', '智慧航运', '数字航运', '航运大数据', '船舶数据分析', '航运数据分析', '区块链航运', '数字孪生港口', '港口虚拟化'],
            '节能减排': ['船舶能效', '船舶节能', '能效优化', '减排技术', '压载水处理', '脱硫塔', '脱硝系统', '废气净化', '氮氧化物减排', '硫氧化物减排', '碳排放控制'],
            '港口设备': ['起重机', '吊装设备', '龙门吊', '门式起重机', '岸桥', '岸边起重机', '堆场机械', '堆场设备', 'AGV', '自动导引车', '无人集卡', '自动驾驶卡车', '港口无人车']
        }
    
    def normalize_terminology(self, text: str) -> str:
        normalized = text
        for old_term, new_term in self.terminology_mapping.items():
            normalized = re.sub(re.escape(old_term), new_term, normalized)
        return normalized
    
    def extract_keywords(self, text: str) -> List[str]:
        text = self.normalize_terminology(text)
        words = jieba.cut(text)
        keywords = [word.strip() for word in words if len(word.strip()) > 1]
        return list(set(keywords))
    
    def classify_tech_field(self, text: str) -> str:
        text = self.normalize_terminology(text)
        keywords = self.extract_keywords(text)
        
        field_scores = {}
        for field, field_keywords in self.tech_field_keywords.items():
            score = 0
            for keyword in keywords:
                for field_keyword in field_keywords:
                    if keyword in field_keyword or field_keyword in keyword:
                        score += 1
            field_scores[field] = score
        
        if field_scores:
            return max(field_scores.items(), key=lambda x: x[1])[0]
        return '通用技术'
    
    def extract_trl_level(self, text: str) -> int:
        trl_patterns = {
            1: ['概念', '理论', '原理', '设想', '初步构想'],
            2: ['概念验证', '可行性', '初步验证', '实验室研究', '理论验证'],
            3: ['实验验证', '原型', '实验室', '模型试验', '水池试验', '风洞试验'],
            4: ['组件', '子系统', '实验室环境', '样机', '模型船', '试验船'],
            5: ['相关环境', '模拟环境', '原型系统', '实船试验', '海试', '试航'],
            6: ['相关环境', '演示', '样机', '示范船', '演示验证', '试运行'],
            7: ['实际环境', '运行', '系统', '实船', '商业运营', '实际航行'],
            8: ['完成', '合格', '定型', '批量建造', '系列建造', '标准船型'],
            9: ['实际运行', '成功', '部署', '成熟技术', '广泛应用', '商业化']
        }
        
        text_lower = text.lower()
        for trl, patterns in trl_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return trl
        return 3
    
    def extract_budget_range(self, text: str) -> Tuple[float, float]:
        budget_patterns = [
            r'(\d+(?:\.\d+)?)\s*千万元',
            r'(\d+(?:\.\d+)?)\s*百万元',
            r'(\d+(?:\.\d+)?)\s*亿元',
            r'(\d+(?:\.\d+)?)\s*万\s*美元',
            r'(\d+(?:\.\d+)?)\s*千\s*美元',
            r'(\d+(?:\.\d+)?)\s*百\s*美元',
            r'(\d+(?:\.\d+)?)\s*万\s*美元',
            r'(\d+(?:\.\d+)?)\s*万元',
            r'(\d+(?:\.\d+)?)\s*万',
            r'(\d+(?:\.\d+)?)\s*千\s*元',
            r'(\d+(?:\.\d+)?)\s*千元',
            r'(\d+(?:\.\d+)?)\s*千'
        ]
        
        budgets = []
        for pattern in budget_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                value = float(match)
                if '千万元' in pattern:
                    value = value * 1000
                elif '百万元' in pattern:
                    value = value * 100
                elif '亿元' in pattern:
                    value = value * 10000
                elif '千美元' in pattern:
                    value = value * 7 / 10
                elif '百美元' in pattern:
                    value = value * 7 / 100
                elif '万美元' in pattern:
                    value = value * 7
                elif '千' in pattern:
                    value = value / 10
                budgets.append(value)
        
        if budgets:
            return (min(budgets), max(budgets))
        return (0, 0)
    
    def extract_region(self, text: str) -> str:
        region_mapping = {
            '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东', '福建': '华东',
            '江西': '华东', '山东': '华东', '广东': '华南', '广西': '华南', '海南': '华南',
            '湖北': '华中', '湖南': '华中', '河南': '华中',
            '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南',
            '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '西北',
            '辽宁': '东北', '吉林': '东北', '黑龙江': '东北',
            '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北',
            '北京': '华北',
            '大连': '东北', '青岛': '华东', '宁波': '华东', '厦门': '华东', '广州': '华南',
            '深圳': '华南', '珠海': '华南', '湛江': '华南', '海口': '华南',
            '武汉': '华中', '长沙': '华中', '郑州': '华中',
            '成都': '西南', '重庆': '西南', '昆明': '西南', '贵阳': '西南',
            '西安': '西北', '兰州': '西北', '乌鲁木齐': '西北',
            '哈尔滨': '东北', '沈阳': '东北', '长春': '东北',
            '长三角': '华东', '珠三角': '华南', '环渤海': '华北',
            '长江流域': '华东', '珠江流域': '华南', '沿海地区': '全国',
            '国际': '国际', '海外': '国际', '全球': '国际'
        }
        
        for province, region in region_mapping.items():
            if province in text:
                return region
        return '全国'
    
    def extract_cooperation_mode(self, text: str) -> List[str]:
        modes = []
        mode_keywords = {
            '技术转让': ['技术转让', '技术许可', '专利转让', '技术授权', '专利授权'],
            '技术入股': ['技术入股', '股权合作', '技术股权', '合资合作'],
            '联合开发': ['联合开发', '合作开发', '共同研发', '联合设计', '合作设计'],
            '技术服务': ['技术服务', '技术咨询', '技术支持', '技术指导', '技术培训'],
            '授权使用': ['授权', '许可使用', '独占许可', '排他许可', '普通许可'],
            '合作生产': ['合作生产', '联合生产', '代工生产', 'OEM生产', '委托加工'],
            '船舶租赁': ['光船租赁', '期租', '程租', '包运', '定期租赁', '航次租赁'],
            '船舶运营': ['船舶运营', '航运运营', '船队管理', '船舶调度', '航运管理'],
            '港口合作': ['港口合作', '码头合作', '港口运营', '港口管理'],
            '海工合作': ['海工合作', '海洋工程合作', '海工装备合作'],
            '供应链合作': ['供应链合作', '物流合作', '货运合作', '航运物流合作']
        }
        
        for mode, keywords in mode_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    modes.append(mode)
                    break
        
        return modes if modes else ['技术转让']
    
    def preprocess_enterprise_demand(self, demand_data: Dict[str, Any]) -> Dict[str, Any]:
        processed = {
            'id': demand_data.get('id', ''),
            'label': demand_data.get('label', ''),
            'type': demand_data.get('type', 'technical requirements'),
            'normalized_text': self.normalize_terminology(demand_data.get('label', '')),
            'keywords': self.extract_keywords(demand_data.get('label', '')),
            'tech_field': self.classify_tech_field(demand_data.get('label', '')),
            'trl_level': self.extract_trl_level(demand_data.get('label', '')),
            'budget_range': self.extract_budget_range(demand_data.get('label', '')),
            'region': self.extract_region(demand_data.get('label', '')),
            'enterprise_id': demand_data.get('enterprise_id', ''),
            'category': demand_data.get('category', '技术需求')
        }
        return processed
    
    def preprocess_school_achievement(self, achievement_data: Dict[str, Any]) -> Dict[str, Any]:
        processed = {
            'id': achievement_data.get('id', ''),
            'label': achievement_data.get('label', ''),
            'type': achievement_data.get('type', 'Patent'),
            'normalized_text': self.normalize_terminology(achievement_data.get('label', '')),
            'keywords': self.extract_keywords(achievement_data.get('label', '')),
            'tech_field': self.classify_tech_field(achievement_data.get('label', '')),
            'trl_level': self.extract_trl_level(achievement_data.get('label', '')),
            'patent_number': achievement_data.get('patent_number', ''),
            'team': achievement_data.get('team', ''),
            'transferable': achievement_data.get('transferable', True),
            'cooperation_modes': self.extract_cooperation_mode(achievement_data.get('label', '')),
            'category': achievement_data.get('category', '科技成果')
        }
        return processed
    
    def align_entities(self, demand: Dict[str, Any], achievement: Dict[str, Any]) -> Dict[str, Any]:
        alignment_score = 0
        
        if demand['tech_field'] == achievement['tech_field']:
            alignment_score += 0.3
        
        demand_keywords = set(demand['keywords'])
        achievement_keywords = set(achievement['keywords'])
        
        if demand_keywords & achievement_keywords:
            overlap_ratio = len(demand_keywords & achievement_keywords) / len(demand_keywords | achievement_keywords)
            alignment_score += overlap_ratio * 0.4
        
        trl_diff = abs(demand['trl_level'] - achievement['trl_level'])
        trl_score = max(0, 1 - trl_diff / 9)
        alignment_score += trl_score * 0.3
        
        return {
            'alignment_score': alignment_score,
            'tech_field_match': demand['tech_field'] == achievement['tech_field'],
            'keyword_overlap': list(demand_keywords & achievement_keywords),
            'trl_compatibility': trl_score
        }
