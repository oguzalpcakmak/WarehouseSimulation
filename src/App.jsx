import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  ConfigProvider, 
  theme, 
  Layout, 
  Card, 
  Upload, 
  Button, 
  Typography, 
  Switch, 
  Progress, 
  Statistic, 
  Row, 
  Col, 
  Table, 
  message, 
  Alert,
  Flex,
  Tag
} from 'antd';
import { 
  CloudUploadOutlined, 
  ExperimentOutlined, 
  DownloadOutlined, 
  ReloadOutlined, 
  LineChartOutlined,
  SunOutlined,
  MoonOutlined,
  FileTextOutlined,
  TableOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  ShopOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { processExcel } from './utils/excelProcessor';
import PickVisualizer from './components/PickVisualizer';
import testData from './data/testData.json';
import { t } from './locales/translations';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [lang, setLang] = useState('tr');
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [stats, setStats] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ stage: '', progress: 0 });
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [isTestData, setIsTestData] = useState(false);
  const [selectedGroupData, setSelectedGroupData] = useState([]);
  const [currentSimStep, setCurrentSimStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  // Theme configuration
  const themeConfig = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 8,
    },
  };

  const loadTestData = useCallback(() => {
    setFile({ name: t(lang, 'testDataName') });
    setRawData(null);
    setProcessedData(testData);
    setIsTestData(true);
    
    const mznRows = testData.filter(r => r.AREA && r.AREA.startsWith('MZN')).length;
    const groups = new Set(testData.map(r => `${r.PICKER_CODE}|${r.PICKCAR_THM}`));
    const totalDist = testData.reduce((sum, r) => sum + parseFloat(r.STEP_DIST || 0), 0);
    
    setStats({
      totalRows: testData.length,
      mznRows,
      totalGroups: groups.size,
      totalDistance: totalDist.toFixed(2)
    });
    
    messageApi.success(t(lang, 'testDataLoaded'));
    setShowVisualizer(true);
  }, [messageApi, lang]);

  const handleFileUpload = useCallback((uploadedFile) => {
    if (!uploadedFile) return false;

    setFile(uploadedFile);
    setProcessedData(null);
    setStats(null);
    setIsTestData(false);
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // "Grup Toplama Verisi" sheet'ini bul
        const sheetName = 'Grup Toplama Verisi';
        if (!workbook.SheetNames.includes(sheetName)) {
          messageApi.error(`"${sheetName}" ${t(lang, 'sheetNotFound')}: ${workbook.SheetNames.join(', ')}`);
          setProcessing(false);
          return;
        }
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        // Kolon isimlerini kontrol et
        const requiredColumns = ['Kullanıcı Kodu', 'TOPLANAN_THM', 'ARTICLE_CODE', 'DATE_START_EXECUTION', 'AREA', 'AISLE', 'X', 'Y', 'Z', 'TOPLANAN_ADET', 'PICKCAR_THM'];
        const firstRow = jsonData[0] || {};
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          messageApi.error(`${t(lang, 'missingColumns')}: ${missingColumns.join(', ')}`);
          setProcessing(false);
          return;
        }
        
        messageApi.success(`${jsonData.length} ${t(lang, 'rowsRead')}`);
        
        // Otomatik dönüştürme
        setTimeout(() => {
          try {
            const { data: processedResult, stats: processStats } = processExcel(jsonData, (p) => {
              setProgress(p);
            });

            setProcessedData(processedResult);
            setStats(processStats);
            setRawData(jsonData);
            messageApi.success(t(lang, 'conversionComplete'));
            setShowVisualizer(true);
          } catch (error) {
            messageApi.error(`${t(lang, 'conversionError')}: ${error.message}`);
            console.error(error);
          } finally {
            setProcessing(false);
          }
        }, 100);
      } catch (error) {
        messageApi.error(`${t(lang, 'excelReadError')}: ${error.message}`);
        console.error(error);
        setProcessing(false);
      }
    };
    reader.onerror = () => {
      messageApi.error(t(lang, 'fileReadError'));
      setProcessing(false);
    };
    reader.readAsArrayBuffer(uploadedFile);
    
    return false; // Prevent default upload behavior
  }, [messageApi, lang]);

  const downloadExcel = useCallback(() => {
    if (!processedData) return;

    // Excel için worksheet oluştur
    const worksheet = XLSX.utils.json_to_sheet(processedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grup Toplama Verisi');
    
    // Excel dosyasını indir
    XLSX.writeFile(workbook, 'Grup_Toplama_Verisi_Out.xlsx');
    messageApi.success(t(lang, 'excelDownloaded'));
  }, [processedData, messageApi, lang]);

  const reset = useCallback(() => {
    setFile(null);
    setRawData(null);
    setProcessedData(null);
    setStats(null);
    setProgress({ stage: '', progress: 0 });
    setShowVisualizer(false);
    setIsTestData(false);
    setSelectedGroupData([]);
    setCurrentSimStep(0);
    messageApi.info(t(lang, 'reset'));
  }, [messageApi, lang]);

  /**
   * İşleme aşamasına göre etiket döndürür
   */
  const getStageLabel = (stage) => {
    const labels = {
      transform: t(lang, 'stageTransform'),
      filter: t(lang, 'stageFilter'),
      group: t(lang, 'stageGroup'),
      order: t(lang, 'stageOrder'),
      complete: t(lang, 'stageComplete')
    };
    return labels[stage] || stage;
  };

  const handleGroupSelect = useCallback((groupData, step) => {
    setSelectedGroupData(groupData);
    setCurrentSimStep(step);
  }, []);

  /** Seçili grup tablosu için sütun tanımları */
  const outputColumns = [
    { title: t(lang, 'colPicker'), dataIndex: 'PICKER_CODE', key: 'picker', width: 80 },
    { title: t(lang, 'colPickcar'), dataIndex: 'PICKCAR_THM', key: 'pickcar', width: 110 },
    { title: t(lang, 'colDate'), dataIndex: 'DATE', key: 'date', width: 100 },
    { title: t(lang, 'colTime'), dataIndex: 'TIME', key: 'time', width: 60 },
    { title: t(lang, 'colArea'), dataIndex: 'AREA', key: 'area', width: 70, render: (text) => <Tag color="blue">{text}</Tag> },
    { title: t(lang, 'colAisle'), dataIndex: 'AISLE', key: 'aisle', width: 70 },
    { title: t(lang, 'colColumn'), dataIndex: 'COLUMN', key: 'column', width: 70 },
    { title: t(lang, 'colShelf'), dataIndex: 'SHELF', key: 'shelf', width: 50 },
    { title: t(lang, 'colLR'), dataIndex: 'LEFT_OR_RIGHT', key: 'lr', width: 50, render: (text) => <Tag color={text === 'L' ? 'red' : 'cyan'}>{text}</Tag> },
    { title: t(lang, 'colOrder'), dataIndex: 'PICK_ORDER', key: 'order', width: 60, render: (text) => <Text strong style={{ color: '#1890ff' }}>{text}</Text> },
    { title: t(lang, 'colStep'), dataIndex: 'STEP_DIST', key: 'step', width: 80, render: (text) => <Text type="success">{text}m</Text> },
    { title: t(lang, 'colTotal'), dataIndex: 'TOTAL_DIST', key: 'total', width: 90, render: (text) => <Text type="warning">{text}m</Text> },
  ];

  return (
    <ConfigProvider theme={themeConfig}>
      {contextHolder}
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 24px',
          background: isDarkMode ? '#141414' : '#fff',
          borderBottom: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`
        }}>
          <Flex align="center" gap={12}>
            <ShopOutlined style={{ fontSize: '24px' }} />
            <Title level={4} style={{ margin: 0 }}>{t(lang, 'appTitle')}</Title>
          </Flex>
          <Flex align="center" gap={16}>
            {/* Language Switch */}
            <Flex align="center" gap={4}>
              <GlobalOutlined style={{ color: '#1890ff' }} />
              <Switch 
                checked={lang === 'en'} 
                onChange={(checked) => setLang(checked ? 'en' : 'tr')}
                checkedChildren="EN"
                unCheckedChildren="TR"
                size="small"
              />
            </Flex>
            {/* Theme Switch */}
            <Flex align="center" gap={8}>
              <SunOutlined style={{ color: isDarkMode ? '#666' : '#faad14' }} />
              <Switch 
                checked={isDarkMode} 
                onChange={setIsDarkMode}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
              />
              <MoonOutlined style={{ color: isDarkMode ? '#1890ff' : '#666' }} />
            </Flex>
          </Flex>
        </Header>

        <Content style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

          {/* Upload Section */}
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={14}>
                <Dragger
                  name="file"
                  accept=".xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  style={{ padding: '20px 0' }}
                >
                  <p className="ant-upload-drag-icon">
                    <CloudUploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                  </p>
                  <p className="ant-upload-text">{t(lang, 'uploadTitle')}</p>
                  <p className="ant-upload-hint">{t(lang, 'uploadHint')}</p>
                </Dragger>
              </Col>
              <Col xs={24} md={10}>
                <Card 
                  style={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center',
                    background: isDarkMode ? '#1f1f1f' : '#fafafa',
                    border: '2px dashed #faad14'
                  }}
                >
                  <Flex vertical align="center" gap={16}>
                    <ExperimentOutlined style={{ fontSize: 48, color: '#faad14' }} />
                    <Button 
                      type="primary" 
                      icon={<ExperimentOutlined />} 
                      size="large"
                      onClick={loadTestData}
                      style={{ background: '#faad14', borderColor: '#faad14' }}
                    >
                      {t(lang, 'loadTestData')}
                    </Button>
                  </Flex>
                </Card>
              </Col>
            </Row>

            {file && (
              <Alert
                style={{ marginTop: 16 }}
                message={`${t(lang, 'uploadedFile')}: ${file.name}`}
                type="success"
                showIcon
                icon={<FileTextOutlined />}
              />
            )}
          </Card>

          {/* Progress Section */}
          {processing && (
            <Card style={{ marginBottom: 24 }}>
              <Text>{getStageLabel(progress.stage)}</Text>
              <Progress percent={Math.round(progress.progress)} status="active" />
            </Card>
          )}

          {/* Stats Section */}
          {stats && (
            <Card style={{ marginBottom: 24 }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic 
                    title={t(lang, 'totalRows')} 
                    value={stats.totalRows} 
                    prefix={<FileTextOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic 
                    title={t(lang, 'mznRows')} 
                    value={stats.mznRows} 
                    prefix={<TableOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic 
                    title={t(lang, 'pickGroups')} 
                    value={stats.totalGroups} 
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic 
                    title={t(lang, 'totalDistance')} 
                    value={(stats.totalDistance / 1000).toFixed(2)} 
                    suffix="km"
                    prefix={<NodeIndexOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* Action Buttons */}
          <Card style={{ marginBottom: 24 }}>
            <Flex wrap="wrap" gap={12} justify="center">
              {processedData && (
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />} 
                  size="large"
                  onClick={downloadExcel}
                >
                  {t(lang, 'downloadExcel')}
                </Button>
              )}
              {processedData && (
                <Button 
                  type={showVisualizer ? 'primary' : 'default'}
                  icon={<LineChartOutlined />} 
                  size="large"
                  onClick={() => setShowVisualizer(!showVisualizer)}
                >
                  {showVisualizer ? t(lang, 'hideVisualization') : t(lang, 'visualize')}
                </Button>
              )}
              {(file || processedData) && (
                <Button 
                  danger
                  icon={<ReloadOutlined />} 
                  size="large"
                  onClick={reset}
                >
                  {t(lang, 'resetBtn')}
                </Button>
              )}
            </Flex>
          </Card>

          {/* Visualizer */}
          {showVisualizer && processedData && (
            <Card style={{ marginBottom: 24 }}>
              <PickVisualizer data={processedData} isDarkMode={isDarkMode} onGroupSelect={handleGroupSelect} lang={lang} />
            </Card>
          )}

          {/* Selected Group Data Table */}
          {showVisualizer && selectedGroupData.length > 0 && (
            <Card 
              title={
                <Flex align="center" gap={8}>
                  <TableOutlined />
                  <span>{t(lang, 'selectedGroupTitle')} ({selectedGroupData.length} {t(lang, 'rows')})</span>
                </Flex>
              }
            >
              <Table 
                dataSource={selectedGroupData.map((row, i) => ({ ...row, key: i }))} 
                columns={outputColumns}
                size="small"
                scroll={{ x: 'max-content', y: 400 }}
                pagination={false}
                rowClassName={(record, index) => index === currentSimStep ? 'ant-table-row-selected' : ''}
              />
            </Card>
          )}
        </Content>

        <Footer style={{ textAlign: 'center', background: 'transparent' }}>
          <Text type="secondary">{t(lang, 'footerText')}</Text>
        </Footer>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
