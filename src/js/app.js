// 汽车费用追踪应用 - 主逻辑
// 版本: 1.52
// 功能: 充电记录、停车记录、数据统计、Excel导入导出

// 数据存储类
class DataStorage {
    static getChargingRecords() {
        const records = localStorage.getItem('chargingRecords');
        return records ? JSON.parse(records) : [];
    }

    static saveChargingRecords(records) {
        localStorage.setItem('chargingRecords', JSON.stringify(records));
    }

    static getParkingRecords() {
        const records = localStorage.getItem('parkingRecords');
        return records ? JSON.parse(records) : [];
    }

    static saveParkingRecords(records) {
        localStorage.setItem('parkingRecords', JSON.stringify(records));
    }
}

// 工具函数类
class Utils {
    // 格式化日期为 YYYY年MM月DD日
    static formatDate(date) {
        if (!date) return '';
        
        let d;
        
        // 检查是否为Excel日期序列号（数字格式）
        if (typeof date === 'number') {
            d = new Date(Date.UTC(1899, 11, 30) + date * 24 * 60 * 60 * 1000);
        } else {
            d = new Date(date);
        }
        
        if (isNaN(d.getTime())) return date;
        
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }

    // 获取当前月份 (YYYY-MM)
    static getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // 获取当前年份
    static getCurrentYear() {
        return new Date().getFullYear().toString();
    }

    // 判断日期是否在指定时间范围内
    static isDateInRange(date, range) {
        const recordDate = new Date(date);
        const now = new Date();
        
        switch(range) {
            case 'month':
                return recordDate.getFullYear() === now.getFullYear() && 
                       recordDate.getMonth() === now.getMonth();
            case 'year':
                return recordDate.getFullYear() === now.getFullYear();
            case 'lastMonth':
                const lastMonth = now.getMonth() - 1;
                const lastMonthYear = now.getFullYear();
                if (lastMonth === -1) {
                    return recordDate.getFullYear() === lastMonthYear - 1 && 
                           recordDate.getMonth() === 11;
                }
                return recordDate.getFullYear() === lastMonthYear && 
                       recordDate.getMonth() === lastMonth;
            case 'lastYear':
                return recordDate.getFullYear() === now.getFullYear() - 1;
            default:
                return true;
        }
    }

    // 从文本中提取数字
    static extractNumber(text) {
        const match = text?.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : null;
    }

    // 从文本中提取日期（支持多种格式）
    static extractDate(text) {
        if (!text) return new Date().toISOString().split('T')[0];
        
        // 匹配 YYYY-MM-DD 或 YYYY/MM/DD 格式
        let match = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            return new Date(year, month, day).toISOString().split('T')[0];
        }

        // 匹配 YYYY年MM月DD日 格式
        match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            return new Date(year, month, day).toISOString().split('T')[0];
        }

        return new Date().toISOString().split('T')[0];
    }

    // 安全解析浮点数
    static safeParseFloat(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'string') {
            value = value.replace(/,/g, '').trim();
        }
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }

    // 格式化数字，保留两位小数
    static formatNumber(value) {
        return parseFloat(value).toFixed(2);
    }
}

// 电耗计算类
class ElectricityCalculator {
    // 计算百公里电耗
    static calculateElectricityPer100km(records) {
        if (!records || records.length < 2) return 0;
        
        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
        const fullChargingRecords = sortedRecords.filter(record => record.isFull);
        
        if (fullChargingRecords.length < 2) return 0;

        const prevFull = fullChargingRecords[fullChargingRecords.length - 2];
        const currFull = fullChargingRecords[fullChargingRecords.length - 1];

        const recordsBetweenFull = sortedRecords.filter(record => {
            const recordDate = new Date(record.date);
            const prevFullDate = new Date(prevFull.date);
            const currFullDate = new Date(currFull.date);
            return recordDate > prevFullDate && recordDate <= currFullDate;
        });

        const totalElectricity = recordsBetweenFull.reduce((sum, record) => 
            sum + Utils.safeParseFloat(record.amount), 0);
        
        const mileageDiff = currFull.mileage - prevFull.mileage;
        
        return mileageDiff > 0 ? (totalElectricity / mileageDiff * 100).toFixed(2) : 0;
    }

    // 计算总费用
    static calculateTotalFee(records, timeRange) {
        const filteredRecords = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        return filteredRecords.reduce((sum, record) => 
            sum + Utils.safeParseFloat(record.cost), 0).toFixed(2);
    }

    // 计算总天数
    static calculateTotalDays() {
        const chargingRecords = DataStorage.getChargingRecords();
        const parkingRecords = DataStorage.getParkingRecords();
        
        if (chargingRecords.length === 0 && parkingRecords.length === 0) return 0;
        
        const allDates = [
            ...chargingRecords.map(record => new Date(record.date)),
            ...parkingRecords.map(record => new Date(record.date))
        ];
        
        if (allDates.length === 0) return 0;
        
        const earliestDate = new Date(Math.min(...allDates));
        const today = new Date();
        
        earliestDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const timeDiff = today - earliestDate;
        const diffDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    // 计算总里程
    static calculateTotalMileage(records, timeRange) {
        const filteredRecords = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        if (filteredRecords.length < 2) return 0;

        filteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
        return filteredRecords[filteredRecords.length - 1].mileage - filteredRecords[0].mileage;
    }

    // 计算充满次数
    static calculateFullChargeCount(records, timeRange) {
        const filteredRecords = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        return filteredRecords.filter(record => record.isFull).length;
    }

    // 计算总用电量
    static calculateTotalElectricity(records, timeRange) {
        const filteredRecords = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        return filteredRecords.reduce((sum, record) => 
            sum + Utils.safeParseFloat(record.amount), 0).toFixed(2);
    }

    // 计算每公里费用
    static calculateCostPerKm(records, parkingRecords, timeRange) {
        const filteredRecordsForFee = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        if (filteredRecordsForFee.length === 0) return 0;
        
        const totalChargingFee = filteredRecordsForFee.reduce((sum, record) => 
            sum + Utils.safeParseFloat(record.cost), 0);
        
        const allRecords = [...records].sort((a, b) => 
            Utils.safeParseFloat(b.mileage) - Utils.safeParseFloat(a.mileage));
        
        if (allRecords.length === 0) return 0;
        
        const maxMileageRecord = allRecords[0];
        let mileageDiff = 0;
        
        if (timeRange === 'month') {
            const lastMonthRecords = records.filter(record => 
                Utils.isDateInRange(record.date, 'lastMonth'));
            
            if (lastMonthRecords.length > 0) {
                const lastMonthMaxRecord = [...lastMonthRecords].sort((a, b) => 
                    Utils.safeParseFloat(b.mileage) - Utils.safeParseFloat(a.mileage))[0];
                mileageDiff = maxMileageRecord.mileage - lastMonthMaxRecord.mileage;
            } else {
                const minMileageRecord = allRecords[allRecords.length - 1];
                mileageDiff = maxMileageRecord.mileage - minMileageRecord.mileage;
            }
        } else if (timeRange === 'year') {
            const lastYearRecords = records.filter(record => 
                Utils.isDateInRange(record.date, 'lastYear'));
            
            if (lastYearRecords.length > 0) {
                const lastYearMaxRecord = [...lastYearRecords].sort((a, b) => 
                    Utils.safeParseFloat(b.mileage) - Utils.safeParseFloat(a.mileage))[0];
                mileageDiff = maxMileageRecord.mileage - lastYearMaxRecord.mileage;
            } else {
                const minMileageRecord = allRecords[allRecords.length - 1];
                mileageDiff = maxMileageRecord.mileage - minMileageRecord.mileage;
            }
        } else {
            const minMileageRecord = allRecords[allRecords.length - 1];
            mileageDiff = maxMileageRecord.mileage - minMileageRecord.mileage;
        }
        
        return mileageDiff > 0 ? (totalChargingFee / mileageDiff).toFixed(2) : 0;
    }

    // 计算每天费用
    static calculateCostPerDay(records, parkingRecords, timeRange) {
        if (records.length === 0 && parkingRecords.length === 0) return "0.00";
        
        const calculateDaysBetween = (startDate, endDate) => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            
            const timeDiff = end - start;
            const days = Math.floor(timeDiff / (1000 * 3600 * 24));
            return Math.max(0, days);
        };
        
        let totalFee = 0;
        let totalDays = 0;
        
        switch (timeRange) {
            case 'month':
                const monthlyChargingFee = Utils.safeParseFloat(
                    this.calculateTotalFee(records, 'month'));
                const monthlyParkingFee = Utils.safeParseFloat(
                    ParkingCalculator.calculateTotalFee(parkingRecords, 'month'));
                totalFee = monthlyChargingFee + monthlyParkingFee;
                
                const monthlyChargingRecords = records.filter(record => 
                    Utils.isDateInRange(record.date, 'month'));
                
                if (monthlyChargingRecords.length > 0) {
                    const sortedMonthlyCharging = [...monthlyChargingRecords].sort((a, b) => 
                        new Date(a.date) - new Date(b.date));
                    const monthlyLastDate = new Date(
                        sortedMonthlyCharging[sortedMonthlyCharging.length - 1].date);
                    
                    const lastMonthChargingRecords = records.filter(record => 
                        Utils.isDateInRange(record.date, 'lastMonth'));
                    
                    if (lastMonthChargingRecords.length > 0) {
                        const sortedLastMonthCharging = [...lastMonthChargingRecords].sort((a, b) => 
                            new Date(a.date) - new Date(b.date));
                        const lastMonthLastDate = new Date(
                            sortedLastMonthCharging[sortedLastMonthCharging.length - 1].date);
                        totalDays = calculateDaysBetween(lastMonthLastDate, monthlyLastDate);
                    } else {
                        totalDays = 1;
                    }
                }
                break;
                
            case 'year':
                const yearlyChargingFee = Utils.safeParseFloat(
                    this.calculateTotalFee(records, 'year'));
                const yearlyParkingFee = Utils.safeParseFloat(
                    ParkingCalculator.calculateTotalFee(parkingRecords, 'year'));
                totalFee = yearlyChargingFee + yearlyParkingFee;
                
                const yearlyChargingRecords = records.filter(record => 
                    Utils.isDateInRange(record.date, 'year'));
                
                if (yearlyChargingRecords.length > 0) {
                    const sortedYearlyCharging = [...yearlyChargingRecords].sort((a, b) => 
                        new Date(a.date) - new Date(b.date));
                    const yearlyLastDate = new Date(
                        sortedYearlyCharging[sortedYearlyCharging.length - 1].date);
                    
                    const lastYearChargingRecords = records.filter(record => 
                        Utils.isDateInRange(record.date, 'lastYear'));
                    
                    if (lastYearChargingRecords.length > 0) {
                        const sortedLastYearCharging = [...lastYearChargingRecords].sort((a, b) => 
                            new Date(a.date) - new Date(b.date));
                        const lastYearLastDate = new Date(
                            sortedLastYearCharging[sortedLastYearCharging.length - 1].date);
                        totalDays = calculateDaysBetween(lastYearLastDate, yearlyLastDate);
                    } else {
                        totalDays = 1;
                    }
                }
                break;
                
            case 'total':
                const totalChargingFee = Utils.safeParseFloat(
                    this.calculateTotalFee(records, 'all'));
                const totalParkingFee = Utils.safeParseFloat(
                    ParkingCalculator.calculateTotalFee(parkingRecords, 'all'));
                totalFee = totalChargingFee + totalParkingFee;
                
                if (records.length > 0) {
                    const sortedAllCharging = [...records].sort((a, b) => 
                        new Date(a.date) - new Date(b.date));
                    const allFirstDate = new Date(sortedAllCharging[0].date);
                    const allLastDate = new Date(
                        sortedAllCharging[sortedAllCharging.length - 1].date);
                    totalDays = calculateDaysBetween(allFirstDate, allLastDate);
                }
                break;
        }
        
        return totalDays > 0 ? (totalFee / totalDays).toFixed(2) : "0.00";
    }
}

// 停车费计算类
class ParkingCalculator {
    static calculateTotalFee(records, timeRange) {
        const filteredRecords = timeRange === 'all' ? records : 
            records.filter(record => Utils.isDateInRange(record.date, timeRange));
        
        return filteredRecords.reduce((sum, record) => 
            sum + Utils.safeParseFloat(record.cost), 0).toFixed(2);
    }
}

// 文本解析器类
class TextParser {
    static parseChargingText(text) {
        const result = {
            date: Utils.extractDate(text),
            mileage: null,
            amount: null,
            price: null,
            cost: null,
            isFull: false
        };

        const mileageMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:km|公里|千米)/i);
        if (mileageMatch) result.mileage = Utils.safeParseFloat(mileageMatch[1]);

        const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:度|kwh)/i);
        if (amountMatch) result.amount = Utils.safeParseFloat(amountMatch[1]);

        const priceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:元\/度|元每度|元每千瓦时)/i);
        if (priceMatch) {
            result.price = Utils.safeParseFloat(priceMatch[1]);
        } else {
            const priceMatch2 = text.match(/单价\s*(\d+(?:\.\d+)?)/i);
            if (priceMatch2) result.price = Utils.safeParseFloat(priceMatch2[1]);
        }

        const costMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:元|费用)/i);
        if (costMatch) result.cost = Utils.safeParseFloat(costMatch[1]);

        if (text.includes('未充满') || text.includes('没充满') || text.includes('不满')) {
            result.isFull = false;
        }

        return result;
    }

    static parseParkingText(text) {
        const result = {
            date: Utils.extractDate(text),
            cost: null
        };

        const costMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:元|费用)/i);
        if (costMatch) {
            result.cost = Utils.safeParseFloat(costMatch[1]);
        } else {
            const number = Utils.extractNumber(text);
            if (number) result.cost = number;
        }

        return result;
    }
}

// 记录渲染器类
class RecordRenderer {
    static renderChargingRecords(records, tbodyElement) {
        if (!records || records.length === 0) {
            tbodyElement.innerHTML = `<tr><td colspan="8" class="empty-state">暂无充电记录</td></tr>`;
            return;
        }
        
        const sortedRecords = [...records].sort((a, b) => 
            new Date(b.date) - new Date(a.date));
        
        const fullRecords = sortedRecords.filter(record => record.isFull);
        
        const recordsWithElectricity = sortedRecords.map(record => {
            let electricity = 0;
            
            if (fullRecords.length >= 2) {
                for (let i = 0; i < fullRecords.length - 1; i++) {
                    const prevFull = fullRecords[i];
                    const currFull = fullRecords[i + 1];
                    
                    const recordDate = new Date(record.date);
                    const prevFullDate = new Date(prevFull.date);
                    const currFullDate = new Date(currFull.date);
                    
                    if (recordDate > prevFullDate && recordDate <= currFullDate) {
                        const periodRecords = sortedRecords.filter(r => {
                            const rDate = new Date(r.date);
                            return rDate > prevFullDate && rDate <= currFullDate;
                        });
                        
                        const totalElectricity = periodRecords.reduce((sum, r) => 
                            sum + Utils.safeParseFloat(r.amount), 0);
                        const mileageDiff = currFull.mileage - prevFull.mileage;
                        
                        if (mileageDiff > 0) {
                            electricity = (totalElectricity / mileageDiff * 100);
                        }
                        break;
                    }
                }
            }
            
            return { ...record, electricity };
        });

        tbodyElement.innerHTML = recordsWithElectricity.map(record => `
            <tr>
                <td>${Utils.formatDate(record.date)}</td>
                <td>${Math.round(Utils.safeParseFloat(record.mileage))}</td>
                <td>${Utils.safeParseFloat(record.amount).toFixed(2)}</td>
                <td>${Utils.safeParseFloat(record.price).toFixed(2)}</td>
                <td>${Utils.safeParseFloat(record.cost).toFixed(2)}</td>
                <td>${record.isFull ? '是' : '否'}</td>
                <td>${record.isFull && record.electricity > 0 ? record.electricity.toFixed(2) : ''}</td>
                <td>
                    <button class="edit-btn" data-id="${record.id}" data-type="charging">修改</button>
                    <button class="delete-btn" data-id="${record.id}" data-type="charging">删除</button>
                </td>
            </tr>
        `).join('');
    }

    static renderParkingRecords(records, tbodyElement) {
        if (!records || records.length === 0) {
            tbodyElement.innerHTML = `<tr><td colspan="3" class="empty-state">暂无停车记录</td></tr>`;
            return;
        }
        
        const sortedRecords = [...records].sort((a, b) => 
            new Date(b.date) - new Date(a.date));

        tbodyElement.innerHTML = sortedRecords.map(record => `
            <tr>
                <td>${Utils.formatDate(record.date)}</td>
                <td>${record.cost || 0}</td>
                <td>
                    <button class="edit-btn" data-id="${record.id}" data-type="parking">修改</button>
                    <button class="delete-btn" data-id="${record.id}" data-type="parking">删除</button>
                </td>
            </tr>
        `).join('');
    }
}

// Excel处理器类 - 修复了WebView兼容性问题
class ExcelProcessor {
    // 导出到Excel
    static exportToExcel(chargingRecords, parkingRecords) {
        try {
            // 检查是否有数据
            if (chargingRecords.length === 0 && parkingRecords.length === 0) {
                alert('没有数据可以导出');
                return false;
            }
            
            const wb = XLSX.utils.book_new();
            
            // 充电记录工作表
            const chargingData = chargingRecords.map(record => ({
                日期: Utils.formatDate(record.date),
                里程: Math.round(Utils.safeParseFloat(record.mileage)),
                充电量: Utils.safeParseFloat(record.amount).toFixed(2),
                电费单价: Utils.safeParseFloat(record.price).toFixed(2),
                本次充电总费用: Utils.safeParseFloat(record.cost).toFixed(2),
                是否充满: record.isFull ? '是' : '否',
                百公里电耗: ''
            }));
            
            const chargingWs = XLSX.utils.json_to_sheet(chargingData);
            XLSX.utils.book_append_sheet(wb, chargingWs, '充电记录');

            // 停车记录工作表
            const parkingData = parkingRecords.map(record => ({
                日期: Utils.formatDate(record.date),
                停车费用: record.cost
            }));
            
            const parkingWs = XLSX.utils.json_to_sheet(parkingData);
            XLSX.utils.book_append_sheet(wb, parkingWs, '停车记录');

            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const fileName = `车辆费用记录_${dateStr}.xlsx`;
            
            // 方法1: 使用Blob和a标签下载（Android WebView兼容）
            try {
                const excelBuffer = XLSX.write(wb, { 
                    bookType: 'xlsx', 
                    type: 'array' 
                });
                
                const blob = new Blob([excelBuffer], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });
                
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.style.display = 'none';
                
                // 添加到DOM并触发点击
                document.body.appendChild(a);
                a.click();
                
                // 清理
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                
                localStorage.setItem('lastExportTime', now.toISOString());
                return true;
            } catch (blobError) {
                console.warn('Blob方式导出失败，尝试Base64方式:', blobError);
                
                // 方法2: 使用Base64方式（Android 4.4+ WebView兼容）
                try {
                    const base64 = XLSX.write(wb, { 
                        bookType: 'xlsx', 
                        type: 'base64' 
                    });
                    
                    // 创建Data URI
                    const dataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
                    const a = document.createElement('a');
                    a.href = dataUri;
                    a.download = fileName;
                    a.style.display = 'none';
                    
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(a);
                    }, 100);
                    
                    localStorage.setItem('lastExportTime', now.toISOString());
                    return true;
                } catch (base64Error) {
                    console.error('Base64方式导出失败:', base64Error);
                    
                    // 方法3: 备用方案 - 使用CSV格式
                    alert('Excel导出失败，正在尝试CSV格式...');
                    return this.exportToCSV(chargingRecords, parkingRecords);
                }
            }
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
            return false;
        }
    }
    
    // CSV导出备用方案
    static exportToCSV(chargingRecords, parkingRecords) {
        try {
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const fileName = `车辆费用记录_${dateStr}.csv`;
            
            // 创建CSV内容
            let csvContent = "车辆费用记录\n\n";
            
            // 充电记录
            csvContent += "充电记录\n";
            csvContent += "日期,里程(公里),充电量(度),电费单价(元/度),本次充电费用(元),是否充满\n";
            
            chargingRecords.forEach(record => {
                csvContent += `${Utils.formatDate(record.date)},`;
                csvContent += `${Math.round(Utils.safeParseFloat(record.mileage))},`;
                csvContent += `${Utils.safeParseFloat(record.amount).toFixed(2)},`;
                csvContent += `${Utils.safeParseFloat(record.price).toFixed(2)},`;
                csvContent += `${Utils.safeParseFloat(record.cost).toFixed(2)},`;
                csvContent += `${record.isFull ? '是' : '否'}\n`;
            });
            
            csvContent += "\n停车记录\n";
            csvContent += "日期,停车费用(元)\n";
            
            parkingRecords.forEach(record => {
                csvContent += `${Utils.formatDate(record.date)},`;
                csvContent += `${record.cost}\n`;
            });
            
            // 使用Data URI方式导出CSV
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            localStorage.setItem('lastExportTime', now.toISOString());
            return true;
        } catch (error) {
            console.error('CSV导出失败:', error);
            alert('所有导出方式都失败了，请检查存储权限');
            return false;
        }
    }

    // 从Excel导入
    static importFromExcel(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('未选择文件'));
                return;
            }

            // 检查文件类型
            if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
                reject(new Error('请选择Excel文件(.xlsx, .xls)或CSV文件(.csv)'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let result;
                    if (file.name.match(/\.csv$/i)) {
                        result = this.parseCSV(e.target.result);
                    } else {
                        result = this.parseExcel(e.target.result);
                    }
                    resolve(result);
                } catch (error) {
                    reject(new Error('文件解析失败: ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    // 解析Excel文件
    static parseExcel(arrayBuffer) {
        const wb = XLSX.read(arrayBuffer, { 
            type: 'array',
            cellDates: true,
            cellNF: false,
            cellText: true
        });

        const result = {
            chargingRecords: [],
            parkingRecords: []
        };

        // 读取充电记录
        const chargingWs = wb.Sheets['充电记录'];
        if (chargingWs) {
            const chargingData = XLSX.utils.sheet_to_json(chargingWs);
            
            result.chargingRecords = chargingData.map((record, index) => ({
                id: `charging_${Date.now()}_${index}`,
                date: this.normalizeDate(record['日期']),
                mileage: Utils.safeParseFloat(record['里程']),
                amount: Utils.safeParseFloat(record['充电量']),
                price: Utils.safeParseFloat(record['电费单价']),
                cost: Utils.safeParseFloat(record['本次充电总费用']),
                isFull: String(record['是否充满']).trim() === '是'
            })).filter(record => record.date && record.mileage > 0);
        }

        // 读取停车记录
        const parkingWs = wb.Sheets['停车记录'];
        if (parkingWs) {
            const parkingData = XLSX.utils.sheet_to_json(parkingWs);
            
            result.parkingRecords = parkingData.map((record, index) => ({
                id: `parking_${Date.now()}_${index}`,
                date: this.normalizeDate(record['日期']),
                cost: Utils.safeParseFloat(record['停车费用'])
            })).filter(record => record.date && record.cost > 0);
        }

        return result;
    }

    // 解析CSV文件
    static parseCSV(csvData) {
        const result = {
            chargingRecords: [],
            parkingRecords: []
        };

        // 简化的CSV解析逻辑
        const text = new TextDecoder('utf-8').decode(csvData);
        const lines = text.split('\n').filter(line => line.trim());
        
        let section = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line === '充电记录') {
                section = 'charging';
                i++; // 跳过标题行
                continue;
            } else if (line === '停车记录') {
                section = 'parking';
                i++; // 跳过标题行
                continue;
            } else if (line === '车辆费用记录' || line === '') {
                continue;
            }

            const columns = line.split(',').map(col => col.trim());
            
            if (section === 'charging' && columns.length >= 6) {
                result.chargingRecords.push({
                    id: `charging_${Date.now()}_${i}`,
                    date: this.normalizeDate(columns[0]),
                    mileage: Utils.safeParseFloat(columns[1]),
                    amount: Utils.safeParseFloat(columns[2]),
                    price: Utils.safeParseFloat(columns[3]),
                    cost: Utils.safeParseFloat(columns[4]),
                    isFull: columns[5] === '是'
                });
            } else if (section === 'parking' && columns.length >= 2) {
                result.parkingRecords.push({
                    id: `parking_${Date.now()}_${i}`,
                    date: this.normalizeDate(columns[0]),
                    cost: Utils.safeParseFloat(columns[1])
                });
            }
        }

        return result;
    }

    // 标准化日期格式
    static normalizeDate(dateValue) {
        if (!dateValue) return new Date().toISOString().split('T')[0];
        
        let dateStr = dateValue;
        
        // 如果已经是Date对象
        if (dateValue instanceof Date) {
            return dateValue.toISOString().split('T')[0];
        }
        
        // 处理Excel日期序列号
        if (typeof dateValue === 'number') {
            try {
                const date = XLSX.SSF.parse_date_code(dateValue);
                if (date) {
                    return `${date.y}-${String(date.m + 1).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
                }
            } catch (e) {
                // 忽略错误，继续尝试其他格式
            }
        }
        
        dateStr = String(dateStr);
        
        // 匹配 YYYY年MM月DD日 格式
        let match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]);
            const day = parseInt(match[3]);
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        // 匹配 YYYY-MM-DD 格式
        match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]);
            const day = parseInt(match[3]);
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        // 匹配 YYYY/MM/DD 格式
        match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]);
            const day = parseInt(match[3]);
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        // 尝试Date.parse
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // 忽略错误
        }
        
        // 默认返回今天
        return new Date().toISOString().split('T')[0];
    }
}

// 主应用类
class CarExpenseTracker {
    constructor() {
        this.currentTimeRange = 'month';
        this.costTimeRange = 'total';
        this.chargingChart = null;
        this.costChart = null;
        
        // 缓存DOM元素
        this.domCache = {};
        this.init();
    }

    // 初始化应用
    init() {
        this.cacheDOMElements();
        this.setDefaultDate();
        this.setupEventDelegation();
        this.render();
    }

    // 缓存DOM元素
    cacheDOMElements() {
        this.domCache = {
            container: document.querySelector('.container'),
            dashboard: document.getElementById('dashboard'),
            chargingForm: document.getElementById('chargingForm'),
            parkingForm: document.getElementById('parkingForm'),
            chargingRecordsTbody: document.getElementById('chargingRecords'),
            parkingRecordsTbody: document.getElementById('parkingRecords'),
            exportInfo: document.getElementById('exportInfo'),
            quickChargingInput: document.getElementById('quickChargingInput'),
            quickParkingInput: document.getElementById('quickParkingInput'),
            importExcelInput: document.getElementById('importExcel')
        };
    }

    // 设置默认日期
    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('chargingDate').value = today;
        document.getElementById('parkingDate').value = today;
    }

    // 设置事件委托
    setupEventDelegation() {
        // 使用事件委托处理所有点击事件
        document.addEventListener('click', (e) => this.handleClick(e));
        
        // 表单提交事件
        this.domCache.chargingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addChargingRecord();
        });
        
        this.domCache.parkingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addParkingRecord();
        });

        // 充电表单自动计算
        this.setupChargingFormAutoCalculate();

        // Excel导入
        this.domCache.importExcelInput.addEventListener('change', (e) => {
            this.importFromExcel(e.target.files[0]);
        });

        // 文本输入框回车键支持
        this.domCache.quickChargingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.parseChargingText();
            }
        });

        this.domCache.quickParkingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.parseParkingText();
            }
        });
    }

    // 处理点击事件
    handleClick(e) {
        const target = e.target;
        
        // 导航切换
        if (target.closest('.nav-tab')) {
            const tab = target.closest('.nav-tab');
            this.switchTab(tab.dataset.tab);
            return;
        }
        
        // 时间选择器（仪表盘）
        if (target.closest('#dashboard .time-selector [data-time]')) {
            const btn = target.closest('[data-time]');
            this.switchTimeRange(btn.dataset.time);
            return;
        }
        
        // 费用构成统计方式切换
        if (target.closest('.cost-chart-wrapper .time-selector [data-time]')) {
            const btn = target.closest('[data-time]');
            this.switchCostTimeRange(btn.dataset.time);
            return;
        }
        
        // 录入方式切换
        if (target.closest('.method-btn')) {
            const btn = target.closest('.method-btn');
            const method = btn.dataset.method;
            const section = btn.closest('section');
            this.switchInputMethod(section.id, method);
            return;
        }
        
        // 按钮选择组
        if (target.closest('.radio-btn')) {
            const btn = target.closest('.radio-btn');
            this.handleRadioButtonClick(btn);
            return;
        }
        
        // 表单归零按钮
        if (target.closest('.reset-btn')) {
            const form = target.closest('form');
            this.resetForm(form.id);
            return;
        }
        
        // 展开/收起按钮
        if (target.closest('.expand-btn')) {
            const btn = target.closest('.expand-btn');
            this.toggleExpand(btn);
            return;
        }
        
        // 快速文本输入按钮
        if (target.id === 'parseChargingBtn') {
            this.parseChargingText();
            return;
        }
        
        if (target.id === 'parseParkingBtn') {
            this.parseParkingText();
            return;
        }
        
        // 导出Excel
        if (target.id === 'exportExcel') {
            this.exportToExcel();
            return;
        }
        
        // 导入Excel
        if (target.id === 'importBtn') {
            this.domCache.importExcelInput.click();
            return;
        }
        
        // 数据清零
        if (target.id === 'clearAllData') {
            this.clearAllData();
            return;
        }
        
        // 编辑记录
        if (target.classList.contains('edit-btn')) {
            const id = target.dataset.id;
            const type = target.dataset.type;
            this.editRecord(id, type);
            return;
        }
        
        // 删除记录
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            const type = target.dataset.type;
            this.deleteRecord(id, type);
            return;
        }
    }

    // 切换输入方式
    switchInputMethod(sectionId, method) {
        const section = document.getElementById(sectionId);
        const buttons = section.querySelectorAll('.method-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        section.querySelector(`[data-method="${method}"]`).classList.add('active');
        
        if (method === 'text') {
            section.querySelector('.input-form').classList.remove('hidden');
            section.querySelector('.text-input-area').classList.add('hidden');
        } else {
            section.querySelector('.input-form').classList.add('hidden');
            section.querySelector('.text-input-area').classList.remove('hidden');
        }
    }

    // 处理单选按钮点击
    handleRadioButtonClick(btn) {
        const radioGroup = btn.closest('.radio-group');
        const hiddenInput = radioGroup.nextElementSibling;
        
        radioGroup.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hiddenInput.value = btn.dataset.value;
    }

    // 设置充电表单自动计算
    setupChargingFormAutoCalculate() {
        const amountInput = document.getElementById('chargingAmount');
        const priceInput = document.getElementById('electricityPrice');
        const costInput = document.getElementById('chargingCost');

        const calculate = () => {
            const amount = amountInput.value.trim();
            const price = priceInput.value.trim();
            const cost = costInput.value.trim();

            const hasAmount = amount && !isNaN(parseFloat(amount));
            const hasPrice = price && !isNaN(parseFloat(price));
            const hasCost = cost && !isNaN(parseFloat(cost));
            
            const emptyInputs = [];
            if (!hasAmount) emptyInputs.push('amount');
            if (!hasPrice) emptyInputs.push('price');
            if (!hasCost) emptyInputs.push('cost');
            
            if (emptyInputs.length === 1) {
                const targetInput = emptyInputs[0];
                
                switch(targetInput) {
                    case 'cost':
                        if (hasAmount && hasPrice) {
                            costInput.value = (parseFloat(amount) * parseFloat(price)).toFixed(2);
                        }
                        break;
                    case 'price':
                        if (hasAmount && hasCost) {
                            const amountVal = parseFloat(amount);
                            priceInput.value = amountVal !== 0 ? (parseFloat(cost) / amountVal).toFixed(2) : '0.00';
                        }
                        break;
                    case 'amount':
                        if (hasCost && hasPrice) {
                            const priceVal = parseFloat(price);
                            amountInput.value = priceVal !== 0 ? (parseFloat(cost) / priceVal).toFixed(2) : '0.00';
                        }
                        break;
                }
            }
        };

        [amountInput, priceInput, costInput].forEach(input => {
            input.addEventListener('blur', calculate);
        });
    }

    // 重置表单
    resetForm(formId) {
        const form = document.getElementById(formId);
        const fields = form.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]');
        
        fields.forEach(field => {
            if (field.type === 'date') {
                field.value = new Date().toISOString().split('T')[0];
            } else {
                field.value = '';
            }
        });
        
        // 重置按钮选择组
        const radioGroups = form.querySelectorAll('.radio-group');
        radioGroups.forEach(group => {
            const falseBtn = group.querySelector('[data-value="false"]');
            if (falseBtn) {
                group.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('active'));
                falseBtn.classList.add('active');
                const hiddenInput = group.nextElementSibling;
                if (hiddenInput) hiddenInput.value = 'false';
            }
        });

        // 隐藏成功消息
        const successMsg = form.querySelector('.success-message');
        if (successMsg) successMsg.style.display = 'none';
    }

    // 切换展开/收起
    toggleExpand(btn) {
        const targetId = btn.dataset.target;
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.classList.toggle('hidden');
            btn.classList.toggle('expanded');
            
            if (btn.classList.contains('expanded')) {
                btn.innerHTML = '<span class="icon expand-icon"></span> 收起';
            } else {
                btn.innerHTML = '<span class="icon expand-icon"></span> 展开';
            }
        }
    }

    // 解析充电文本
    parseChargingText() {
        const text = document.getElementById('quickChargingInput').value.trim();
        if (!text) {
            alert('请输入充电记录信息');
            return;
        }
        
        const result = TextParser.parseChargingText(text);
        
        if (result.date) document.getElementById('chargingDate').value = result.date;
        if (result.mileage) document.getElementById('chargingMileage').value = result.mileage;
        if (result.amount) document.getElementById('chargingAmount').value = result.amount;
        if (result.price) document.getElementById('electricityPrice').value = result.price;
        if (result.cost) document.getElementById('chargingCost').value = result.cost;
        
        if (result.isFull === false) {
            const radioGroup = document.querySelector('.radio-group');
            radioGroup.querySelectorAll('.radio-btn').forEach(btn => btn.classList.remove('active'));
            radioGroup.querySelector('[data-value="false"]').classList.add('active');
            document.getElementById('isFull').value = 'false';
        }

        this.switchInputMethod('charging', 'text');
        document.getElementById('quickChargingInput').value = '';
        
        this.showSuccessMessage('chargingSuccess', '✓ 信息已自动填充到表单中');
    }

    // 解析停车文本
    parseParkingText() {
        const text = document.getElementById('quickParkingInput').value.trim();
        if (!text) {
            alert('请输入停车记录信息');
            return;
        }
        
        const result = TextParser.parseParkingText(text);
        
        if (result.date) document.getElementById('parkingDate').value = result.date;
        if (result.cost) document.getElementById('parkingCost').value = result.cost;
        
        this.switchInputMethod('parking', 'text');
        document.getElementById('quickParkingInput').value = '';
        
        this.showSuccessMessage('parkingSuccess', '✓ 信息已自动填充到表单中');
    }

    // 显示成功消息
    showSuccessMessage(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'flex';
            setTimeout(() => {
                element.style.display = 'none';
            }, 3000);
        }
    }

    // 导出到Excel
    exportToExcel() {
        const chargingRecords = DataStorage.getChargingRecords();
        const parkingRecords = DataStorage.getParkingRecords();

        if (chargingRecords.length === 0 && parkingRecords.length === 0) {
            alert('没有数据可导出');
            return;
        }

        const success = ExcelProcessor.exportToExcel(chargingRecords, parkingRecords);
        if (success) {
            setTimeout(() => {
                alert('Excel数据导出成功！文件已开始下载');
                this.updateExportInfo();
            }, 500);
        } else {
            alert('Excel数据导出失败，请检查权限或存储空间');
        }
    }

    // 从Excel导入
    async importFromExcel(file) {
        if (!file) return;
        
        if (!confirm('导入Excel会覆盖现有数据，确定要导入吗？')) {
            return;
        }

        try {
            const result = await ExcelProcessor.importFromExcel(file);
            
            if (result.chargingRecords.length > 0) {
                DataStorage.saveChargingRecords(result.chargingRecords);
            }
            
            if (result.parkingRecords.length > 0) {
                DataStorage.saveParkingRecords(result.parkingRecords);
            }
            
            this.render();
            alert(`导入成功！\n充电记录：${result.chargingRecords.length}条\n停车记录：${result.parkingRecords.length}条`);
        } catch (error) {
            alert('导入失败：' + error.message);
        }
    }

    // 清空所有数据
    clearAllData() {
        if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
            DataStorage.saveChargingRecords([]);
            DataStorage.saveParkingRecords([]);
            this.render();
            alert('所有数据已成功清空！');
        }
    }

    // 切换标签页
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        
        if (tabId === 'statistics') {
            this.renderCharts();
        }
    }

    // 切换时间范围
    switchTimeRange(timeRange) {
        this.currentTimeRange = timeRange;
        document.querySelectorAll('#dashboard .time-selector [data-time]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#dashboard .time-selector [data-time="${timeRange}"]`).classList.add('active');
        this.renderDashboard();
    }

    // 切换费用统计时间范围
    switchCostTimeRange(timeRange) {
        this.costTimeRange = timeRange;
        this.renderCostChart();
    }

    // 添加充电记录
    addChargingRecord() {
        const editRecordId = document.getElementById('editRecordId').value;
        
        const record = {
            date: document.getElementById('chargingDate').value || new Date().toISOString().split('T')[0],
            mileage: Math.round(Utils.safeParseFloat(document.getElementById('chargingMileage').value)),
            amount: Utils.safeParseFloat(document.getElementById('chargingAmount').value),
            price: Utils.safeParseFloat(document.getElementById('electricityPrice').value),
            cost: Utils.safeParseFloat(document.getElementById('chargingCost').value),
            isFull: document.getElementById('isFull').value === 'true'
        };

        if (!record.date || record.mileage <= 0) {
            alert('请填写有效的日期和里程信息（里程必须大于0）');
            return;
        }

        if (record.amount <= 0 && record.price <= 0 && record.cost <= 0) {
            alert('请填写有效的充电量、单价或费用信息（至少一个字段必须大于0）');
            return;
        }

        const records = DataStorage.getChargingRecords();
        
        if (editRecordId) {
            const recordIndex = records.findIndex(r => r.id === editRecordId);
            if (recordIndex !== -1) {
                records[recordIndex] = { ...records[recordIndex], ...record };
                DataStorage.saveChargingRecords(records);
                this.showSuccessMessage('chargingSuccess', '✓ 充电记录修改成功！');
            }
        } else {
            const newRecord = {
                id: `charging_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                ...record
            };
            records.push(newRecord);
            DataStorage.saveChargingRecords(records);
            this.showSuccessMessage('chargingSuccess', '✓ 充电记录保存成功！');
        }

        this.resetForm('chargingForm');
        this.setDefaultDate();
        document.getElementById('editRecordId').value = '';
        this.render();
    }

    // 添加停车记录
    addParkingRecord() {
        const editRecordId = document.getElementById('editParkingRecordId').value;
        
        const record = {
            date: document.getElementById('parkingDate').value || new Date().toISOString().split('T')[0],
            cost: Utils.safeParseFloat(document.getElementById('parkingCost').value)
        };

        if (!record.date || record.cost <= 0) {
            alert('请填写日期和有效的费用信息（费用必须大于0）');
            return;
        }

        const records = DataStorage.getParkingRecords();
        
        if (editRecordId) {
            const recordIndex = records.findIndex(r => r.id === editRecordId);
            if (recordIndex !== -1) {
                records[recordIndex] = { ...records[recordIndex], ...record };
                DataStorage.saveParkingRecords(records);
                this.showSuccessMessage('parkingSuccess', '✓ 停车记录修改成功！');
            }
        } else {
            const newRecord = {
                id: `parking_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                ...record
            };
            records.push(newRecord);
            DataStorage.saveParkingRecords(records);
            this.showSuccessMessage('parkingSuccess', '✓ 停车记录保存成功！');
        }

        this.resetForm('parkingForm');
        this.setDefaultDate();
        document.getElementById('editParkingRecordId').value = '';
        this.render();
    }

    // 编辑记录
    editRecord(id, type) {
        if (type === 'charging') {
            const records = DataStorage.getChargingRecords();
            const record = records.find(r => r.id === id);
            
            if (record) {
                document.getElementById('editRecordId').value = record.id;
                document.getElementById('chargingDate').value = record.date;
                document.getElementById('chargingMileage').value = record.mileage;
                document.getElementById('chargingAmount').value = record.amount;
                document.getElementById('electricityPrice').value = record.price;
                document.getElementById('chargingCost').value = record.cost;
                
                const radioGroup = document.querySelector('.radio-group');
                radioGroup.querySelectorAll('.radio-btn').forEach(btn => btn.classList.remove('active'));
                radioGroup.querySelector(`[data-value="${record.isFull}"]`).classList.add('active');
                document.getElementById('isFull').value = record.isFull.toString();
                
                this.showSuccessMessage('chargingSuccess', '✎ 正在编辑充电记录...');
            }
        } else if (type === 'parking') {
            const records = DataStorage.getParkingRecords();
            const record = records.find(r => r.id === id);
            
            if (record) {
                document.getElementById('editParkingRecordId').value = record.id;
                document.getElementById('parkingDate').value = record.date;
                document.getElementById('parkingCost').value = record.cost;
                
                this.showSuccessMessage('parkingSuccess', '✎ 正在编辑停车记录...');
            }
        }
    }

    // 删除记录
    deleteRecord(id, type) {
        if (!confirm(`确定要删除这条${type === 'charging' ? '充电' : '停车'}记录吗？`)) return;
        
        if (type === 'charging') {
            let records = DataStorage.getChargingRecords();
            records = records.filter(record => record.id != id);
            DataStorage.saveChargingRecords(records);
        } else if (type === 'parking') {
            let records = DataStorage.getParkingRecords();
            records = records.filter(record => record.id != id);
            DataStorage.saveParkingRecords(records);
        }
        
        this.render();
    }

    // 渲染仪表盘
    renderDashboard() {
        const chargingRecords = DataStorage.getChargingRecords();
        const parkingRecords = DataStorage.getParkingRecords();

        this.updateExportInfo();

        // 计算并更新所有数据卡片
        const updateCard = (elementId, value, unit = '') => {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = `<span>${value}</span>${unit ? `<span class="unit">${unit}</span>` : ''}`;
            }
        };

        updateCard('totalDays', ElectricityCalculator.calculateTotalDays(), '天');
        updateCard('electricityPer100km', ElectricityCalculator.calculateElectricityPer100km(chargingRecords), '度/百公里');
        updateCard('totalChargingFee', `¥${ElectricityCalculator.calculateTotalFee(chargingRecords, this.currentTimeRange)}`, '元');
        updateCard('totalParkingFee', `¥${ParkingCalculator.calculateTotalFee(parkingRecords, this.currentTimeRange)}`, '元');
        updateCard('fullChargeCount', ElectricityCalculator.calculateFullChargeCount(chargingRecords, this.currentTimeRange), '次');
        updateCard('totalElectricity', ElectricityCalculator.calculateTotalElectricity(chargingRecords, this.currentTimeRange), '度');
        updateCard('costPerKm', `¥${ElectricityCalculator.calculateCostPerKm(chargingRecords, parkingRecords, this.currentTimeRange)}`, '/公里');
        updateCard('costPerDay', `¥${ElectricityCalculator.calculateCostPerDay(chargingRecords, parkingRecords, this.currentTimeRange)}`, '/天');

        this.renderMonthlyData();
    }

    // 渲染月度数据
    renderMonthlyData() {
        const chargingRecords = DataStorage.getChargingRecords();
        const parkingRecords = DataStorage.getParkingRecords();
        
        let title, totalMileage = 0;
        
        switch (this.currentTimeRange) {
            case 'month':
                title = '本月概览';
                const monthlyCharging = chargingRecords.filter(record => 
                    Utils.isDateInRange(record.date, 'month'));
                
                if (monthlyCharging.length > 0) {
                    const currentMonthMaxMileage = Math.max(...monthlyCharging.map(record => record.mileage));
                    const lastMonthRecords = chargingRecords.filter(record => 
                        Utils.isDateInRange(record.date, 'lastMonth'));
                    
                    if (lastMonthRecords.length > 0) {
                        const lastMonthMaxMileage = Math.max(...lastMonthRecords.map(record => record.mileage));
                        totalMileage = currentMonthMaxMileage - lastMonthMaxMileage;
                    }
                }
                break;
            
            case 'year':
                title = '今年概览';
                const yearlyCharging = chargingRecords.filter(record => 
                    Utils.isDateInRange(record.date, 'year'));
                
                if (yearlyCharging.length > 0) {
                    const currentYearMaxMileage = Math.max(...yearlyCharging.map(record => record.mileage));
                    const lastYearRecords = chargingRecords.filter(record => 
                        Utils.isDateInRange(record.date, 'lastYear'));
                    
                    if (lastYearRecords.length > 0) {
                        const lastYearMaxMileage = Math.max(...lastYearRecords.map(record => record.mileage));
                        totalMileage = currentYearMaxMileage - lastYearMaxMileage;
                    }
                }
                break;
            
            case 'total':
                title = '全部概览';
                if (chargingRecords.length > 0) {
                    const allMaxMileage = Math.max(...chargingRecords.map(record => record.mileage));
                    const allMinMileage = Math.min(...chargingRecords.map(record => record.mileage));
                    totalMileage = allMaxMileage - allMinMileage;
                }
                break;
        }
        
        document.querySelector('.monthly-data h2').innerHTML = `<span class="icon chart-line-icon"></span> ${title}`;

        // 更新概览数据
        const updateMonthlyCard = (index, value, titleText, unit) => {
            const cards = document.querySelectorAll('.monthly-data .cards-container .card');
            if (cards[index]) {
                cards[index].querySelector('h3').textContent = titleText;
                cards[index].querySelector('.card-value').innerHTML = 
                    `<span>${value}</span><span class="unit">${unit}</span>`;
            }
        };

        const timeLabels = {
            'month': ['本月里程', '本月总充电量', '本月充电费用', '本月停车费'],
            'year': ['今年里程', '今年总充电量', '今年充电费用', '今年停车费'],
            'total': ['全部里程', '全部总充电量', '全部充电费用', '全部停车费']
        };

        const labels = timeLabels[this.currentTimeRange] || timeLabels.month;
        
        updateMonthlyCard(0, totalMileage, labels[0], '公里');
        updateMonthlyCard(1, 
            ElectricityCalculator.calculateTotalElectricity(chargingRecords, this.currentTimeRange), 
            labels[1], '度');
        updateMonthlyCard(2, 
            `¥${ElectricityCalculator.calculateTotalFee(chargingRecords, this.currentTimeRange)}`, 
            labels[2], '元');
        updateMonthlyCard(3, 
            `¥${ParkingCalculator.calculateTotalFee(parkingRecords, this.currentTimeRange)}`, 
            labels[3], '元');
    }

    // 更新导出信息
    updateExportInfo() {
        const lastExportTimeStr = localStorage.getItem('lastExportTime');
        const lastExportTimeEl = document.getElementById('lastExportTime');
        const daysSinceExportEl = document.getElementById('daysSinceExport');
        
        if (lastExportTimeStr) {
            const lastExportTime = new Date(lastExportTimeStr);
            const now = new Date();
            
            const formattedDate = `${lastExportTime.getFullYear()}年${String(lastExportTime.getMonth() + 1).padStart(2, '0')}月${String(lastExportTime.getDate()).padStart(2, '0')}日`;
            lastExportTimeEl.textContent = formattedDate;
            
            lastExportTime.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            
            const diffTime = now - lastExportTime;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            daysSinceExportEl.textContent = diffDays;
        } else {
            lastExportTimeEl.textContent = '从未导出';
            daysSinceExportEl.textContent = '0';
        }
    }

    // 渲染充电记录
    renderChargingRecords() {
        const records = DataStorage.getChargingRecords();
        RecordRenderer.renderChargingRecords(records, this.domCache.chargingRecordsTbody);
    }

    // 渲染停车记录
    renderParkingRecords() {
        const records = DataStorage.getParkingRecords();
        RecordRenderer.renderParkingRecords(records, this.domCache.parkingRecordsTbody);
    }

    // 渲染图表
    renderCharts() {
        this.renderElectricityChart();
        this.renderCostChart();
    }

    // 渲染电耗趋势图表
    renderElectricityChart() {
        const chargingRecords = DataStorage.getChargingRecords();
        const chartWrapper = document.getElementById('electricityChart')?.parentElement;
        
        if (!chartWrapper) return;

        if (chargingRecords.length === 0) {
            this.destroyChart('chargingChart');
            chartWrapper.innerHTML = `
                <h3><span class="icon chart-line-icon"></span> 电耗趋势</h3>
                <div class="empty-state" style="height: 180px; display: flex; align-items: center; justify-content: center;">
                    暂无数据
                </div>
            `;
            return;
        }

        const ctx = document.getElementById('electricityChart').getContext('2d');
        const sortedRecords = [...chargingRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
        const fullRecords = sortedRecords.filter(record => record.isFull);
        
        const electricityPer100kmData = [];
        const labels = [];
        
        for (let i = 1; i < fullRecords.length; i++) {
            const prevFull = fullRecords[i - 1];
            const currFull = fullRecords[i];
            
            const recordsBetweenFull = sortedRecords.filter(record => {
                const recordDate = new Date(record.date);
                const prevFullDate = new Date(prevFull.date);
                const currFullDate = new Date(currFull.date);
                return recordDate > prevFullDate && recordDate <= currFullDate;
            });
            
            const totalAmount = recordsBetweenFull.reduce((sum, record) => sum + Utils.safeParseFloat(record.amount), 0);
            const mileageDiff = currFull.mileage - prevFull.mileage;
            
            if (mileageDiff > 0 && totalAmount > 0) {
                const electricityPer100km = (totalAmount / mileageDiff) * 100;
                electricityPer100kmData.push(parseFloat(electricityPer100km.toFixed(2)));
                labels.push(Utils.formatDate(currFull.date));
            }
        }
        
        if (electricityPer100kmData.length === 0) {
            this.destroyChart('chargingChart');
            chartWrapper.innerHTML = `
                <h3><span class="icon chart-line-icon"></span> 电耗趋势</h3>
                <div class="empty-state" style="height: 180px; display: flex; align-items: center; justify-content: center;">
                    暂无数据
                </div>
            `;
            return;
        }

        if (electricityPer100kmData.length > 7) {
            electricityPer100kmData.splice(0, electricityPer100kmData.length - 7);
            labels.splice(0, labels.length - 7);
        }

        this.destroyChart('chargingChart');

        this.chargingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '',
                    data: electricityPer100kmData,
                    borderColor: '#4CAF50',
                    backgroundColor: '#4CAF50',
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20, bottom: 30, left: 10, right: 10 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: (context) => `电耗: ${context.parsed.y.toFixed(1)} 度/百公里`
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#333',
                        font: { size: 11, weight: 'bold' },
                        formatter: (value) => parseFloat(value).toFixed(1) + '度',
                        anchor: 'end',
                        align: 'top',
                        offset: -5
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { display: false }, ticks: { display: false }, display: false },
                    x: { grid: { display: false, drawBorder: false }, ticks: { display: false }, display: false }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // 渲染费用构成图表
    renderCostChart() {
        const chargingRecords = DataStorage.getChargingRecords();
        const parkingRecords = DataStorage.getParkingRecords();
        const currentYear = new Date().getFullYear();
        
        let filteredCharging = chargingRecords;
        let filteredParking = parkingRecords;
        
        if (this.costTimeRange === 'year') {
            filteredCharging = chargingRecords.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getFullYear() === currentYear;
            });
            filteredParking = parkingRecords.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getFullYear() === currentYear;
            });
        }
        
        const totalCharging = filteredCharging.reduce((sum, record) => sum + Utils.safeParseFloat(record.cost), 0);
        const totalParking = filteredParking.reduce((sum, record) => sum + Utils.safeParseFloat(record.cost), 0);
        
        const chartWrapper = document.querySelector('.cost-chart-wrapper');
        if (!chartWrapper) return;
        
        chartWrapper.classList.add('pie-chart-wrapper');
        
        this.destroyChart('costChart');
        
        if (totalCharging === 0 && totalParking === 0) {
            chartWrapper.innerHTML = `
                <h3><span class="icon chart-pie-icon"></span> 费用构成</h3>
                <div class="time-selector" style="margin-bottom: 15px;">
                    <button class="time-btn ${this.costTimeRange === 'year' ? 'active' : ''}" data-time="year">年</button>
                    <button class="time-btn ${this.costTimeRange === 'total' ? 'active' : ''}" data-time="total">全部</button>
                </div>
                <div class="empty-state" style="height: 230px; display: flex; align-items: center; justify-content: center;">
                    暂无数据
                </div>
            `;
            return;
        }
        
        if (!document.getElementById('costChart')) {
            chartWrapper.innerHTML = `
                <h3><span class="icon chart-pie-icon"></span> 费用构成</h3>
                <div class="time-selector" style="margin-bottom: 15px;">
                    <button class="time-btn ${this.costTimeRange === 'year' ? 'active' : ''}" data-time="year">年</button>
                    <button class="time-btn ${this.costTimeRange === 'total' ? 'active' : ''}" data-time="total">全部</button>
                </div>
                <canvas id="costChart"></canvas>
            `;
        }
        
        const ctx = document.getElementById('costChart').getContext('2d');
        
        this.costChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [
                    `充电 ¥${totalCharging.toFixed(0)}元`,
                    `停车 ¥${totalParking.toFixed(0)}元`
                ],
                datasets: [{
                    data: [totalCharging, totalParking],
                    backgroundColor: ['#4CAF50', '#2196F3'],
                    borderColor: ['#ffffff', '#ffffff'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        display: true,
                        labels: {
                            boxWidth: 20,
                            padding: 30,
                            font: { size: 17 },
                            usePointStyle: false,
                            boxHeight: 15,
                            maxWidth: 0,
                            textAlign: 'center',
                            useLineHeightStyle: true,
                            useBorderRadius: true,
                            borderRadius: 3,
                            lineHeight: 1.5
                        }
                    },
                    tooltip: { enabled: false },
                    datalabels: {
                        display: true,
                        color: '#ffffff',
                        font: { size: 24, weight: 'bold' },
                        formatter: (value, context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            return percentage + '%';
                        },
                        textAlign: 'center',
                        anchor: 'center',
                        offset: 40
                    }
                },
                cutout: '0%'
            },
            plugins: [ChartDataLabels]
        });
    }

    // 销毁图表
    destroyChart(chartName) {
        if (chartName === 'chargingChart' && this.chargingChart) {
            this.chargingChart.destroy();
            this.chargingChart = null;
        } else if (chartName === 'costChart' && this.costChart) {
            this.costChart.destroy();
            this.costChart = null;
        }
    }

    // 渲染整个应用
    render() {
        this.renderDashboard();
        this.renderChargingRecords();
        this.renderParkingRecords();
        
        if (document.getElementById('statistics').classList.contains('active')) {
            this.renderCharts();
        }
    }
}

// 初始化应用
const app = new CarExpenseTracker();
window.app = app;