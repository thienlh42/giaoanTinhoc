import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateLessonPlan } from './services/geminiService';
import type { FormData } from './types';
import { LoadingSpinner, DownloadIcon } from './components/icons';

// Fix: Augment the Window interface to include properties for libraries loaded from CDN.
// This resolves TypeScript errors for `window.docx`, `window.marked`, etc.
declare global {
  interface Window {
    docx: any;
    marked: any;
    saveAs: any;
    jspdf: any;
    html2canvas: any;
  }
}

// --- Reusable UI Components ---

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, name, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:string;
  options: string[];
}

const Select: React.FC<SelectProps> = ({ label, name, options, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <select
      id={name}
      name={name}
      {...props}
      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    >
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, name, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      rows={5}
      {...props}
      className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  </div>
);

// --- Lesson Plan Display & Download Component ---

interface LessonPlanDisplayProps {
    lessonPlan: string | null;
    exportFormat: 'Word (.docx)' | 'PDF (.pdf)';
    fileName: string;
    isLoading: boolean;
}

const LessonPlanDisplay: React.FC<LessonPlanDisplayProps> = ({ lessonPlan, exportFormat, fileName, isLoading }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!lessonPlan || isDownloading || typeof window.docx === 'undefined') return;
        setIsDownloading(true);

        const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'giao_an';

        try {
            if (exportFormat === 'Word (.docx)') {
                const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = window.docx;

                const createRuns = (text: string): any[] => {
                    const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
                    return parts.map(part => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return new TextRun({ text: part.slice(2, -2), bold: true });
                        }
                        return new TextRun({ text: part });
                    });
                };

                const docChildren: any[] = [];
                let tableRows: any[] = [];

                const flushTable = () => {
                    if (tableRows.length > 0) {
                        docChildren.push(new Table({ 
                            rows: tableRows, 
                            width: { size: 100, type: WidthType.PERCENTAGE } 
                        }));
                        tableRows = [];
                    }
                };

                const lines = lessonPlan.split('\n');

                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                        if (trimmedLine.includes('---')) return; 

                        const cells = trimmedLine.split('|').slice(1, -1).map(cellContent => {
                            return new TableCell({
                                children: cellContent.trim().split('<br>').map(part => new Paragraph({
                                    children: createRuns(part.trim())
                                })),
                            });
                        });
                        tableRows.push(new TableRow({ children: cells }));
                    } else {
                        flushTable(); 
                        
                        if (line.startsWith('# ')) {
                             docChildren.push(new Paragraph({ 
                                children: createRuns(line.substring(2).trim()), 
                                heading: HeadingLevel.HEADING_1, 
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 300, after: 150 } 
                            }));
                        } else if (line.startsWith('## ')) {
                            docChildren.push(new Paragraph({ children: createRuns(line.substring(3).trim()), heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
                        } else if (line.startsWith('### ')) {
                            docChildren.push(new Paragraph({ children: createRuns(line.substring(4).trim()), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
                        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                             docChildren.push(new Paragraph({ children: createRuns(trimmedLine.substring(2).trim()), bullet: { level: 0 }}));
                        } else if (trimmedLine.length > 0) {
                            docChildren.push(new Paragraph({
                                children: createRuns(line),
                            }));
                        } else {
                            docChildren.push(new Paragraph({})); 
                        }
                    }
                });

                flushTable(); 

                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: docChildren,
                    }],
                });

                const blob = await Packer.toBlob(doc);
                window.saveAs(blob, `${safeFileName}.docx`);
            } else { // PDF
                if (contentRef.current) {
                    const { jsPDF } = window.jspdf;
                    const canvas = await window.html2canvas(contentRef.current, { scale: 2 });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save(`${safeFileName}.pdf`);
                }
            }
        } catch (error) {
            console.error("Download failed:", error);
            alert("Tải xuống thất bại. Vui lòng thử lại.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">Bản xem trước Giáo án</h2>
                {lessonPlan && (
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
                    >
                        {isDownloading ? <LoadingSpinner /> : <DownloadIcon />}
                        {isDownloading ? 'Đang xử lý...' : `Tải xuống ${exportFormat.split(' ')[1]}`}
                    </button>
                )}
            </div>
            <div className="prose max-w-none flex-1 overflow-y-auto pr-2" ref={contentRef}>
                {isLoading && (
                    <div className="flex justify-center items-center h-full">
                        <div className="text-center">
                            <LoadingSpinner />
                            <p className="mt-2 text-gray-600">AI đang soạn giáo án, vui lòng chờ trong giây lát...</p>
                        </div>
                    </div>
                )}
                {!isLoading && !lessonPlan && (
                    <div className="flex justify-center items-center h-full text-gray-500">
                        <p>Điền thông tin và nhấn "Soạn giáo án" để bắt đầu.</p>
                    </div>
                )}
                {lessonPlan && <div dangerouslySetInnerHTML={{ __html: window.marked.parse(lessonPlan) }} />}
            </div>
        </div>
    );
};

// --- Main App Component ---

function App() {
  const [formData, setFormData] = useState<FormData>({
    mon_hoc: "Tin học",
    lop: "6",
    bo_sach: "Cánh Diều",
    ten_bai: "Thông tin, thu nhận và xử lý thông tin",
    muc_tieu: "Biết thông tin là gì.\nBiết được thế nào là thu nhận và xử lý thông tin.\nPhân biệt được thông tin với vật mang tin.\nNêu được các ví dụ về thông tin, vật mang tin.",
    hoat_dong: "Toàn bộ tiến trình",
    chuan_thong_tu: "Công văn 5512/BGDĐT-GDTrH",
    dinh_dang_xuat: "Word (.docx)",
    ten_truong: "Trường THCS Mẫu",
    to_chuyen_mon: "Tổ Khoa học Tự nhiên",
    ten_giao_vien: "Nguyễn Văn A",
  });
  const [lessonPlan, setLessonPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!formData.ten_bai || !formData.muc_tieu || !formData.lop) {
        setError("Vui lòng điền đầy đủ các trường: Lớp, Tên bài học và Yêu cầu cần đạt.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setLessonPlan(null);

    try {
      const result = await generateLessonPlan(formData);
      setLessonPlan(result);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không mong muốn.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(error) {
        const timer = setTimeout(() => setError(null), 5000);
        return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="min-h-screen font-sans text-gray-900">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-indigo-700">Soạn giáo án Tin học THCS - Chuẩn Bộ GD&ĐT</h1>
          <p className="text-gray-600 mt-1">Ứng dụng AI hỗ trợ giáo viên soạn giáo án nhanh chóng, hiệu quả.</p>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
          {/* Form Section */}
          <div className="lg:w-1/3 bg-white p-6 rounded-lg shadow-lg h-fit">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">Thông tin chung</h2>
              <Input label="Tên trường" name="ten_truong" value={formData.ten_truong} onChange={handleInputChange} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Tổ chuyên môn" name="to_chuyen_mon" value={formData.to_chuyen_mon} onChange={handleInputChange} />
                  <Input label="Họ và tên giáo viên" name="ten_giao_vien" value={formData.ten_giao_vien} onChange={handleInputChange} />
              </div>

              <h2 className="text-xl font-bold text-gray-800 border-b pb-2 my-4">Nội dung giáo án</h2>
              <Input label="Môn học" name="mon_hoc" value={formData.mon_hoc} onChange={handleInputChange} disabled />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Lớp" name="lop" placeholder="Ví dụ: 6, 7, 8, 9" value={formData.lop} onChange={handleInputChange} required />
                <Input label="Bộ sách giáo khoa" name="bo_sach" value={formData.bo_sach} onChange={handleInputChange} />
              </div>
              <Input label="Tên bài học" name="ten_bai" placeholder="Ví dụ: Thông tin, thu nhận và xử lý thông tin" value={formData.ten_bai} onChange={handleInputChange} required />
              <Textarea label="Yêu cầu cần đạt / Mục tiêu bài học" name="muc_tieu" value={formData.muc_tieu} onChange={handleInputChange} required />
              <Select
                label="Phần của giáo án muốn soạn"
                name="hoat_dong"
                value={formData.hoat_dong}
                onChange={handleInputChange}
                options={["Toàn bộ tiến trình", "Khởi động", "Hình thành kiến thức mới", "Luyện tập", "Vận dụng - Mở rộng", "Tổng kết"]}
              />
              <Select
                label="Chuẩn theo Công văn / Thông tư"
                name="chuan_thong_tu"
                value={formData.chuan_thong_tu}
                onChange={handleInputChange}
                options={["Công văn 5512/BGDĐT-GDTrH", "Thông tư 32/2018", "Thông tư 22/2021"]}
              />
              <Select
                label="Định dạng xuất"
                name="dinh_dang_xuat"
                value={formData.dinh_dang_xuat}
                onChange={handleInputChange}
                options={["Word (.docx)", "PDF (.pdf)"]}
              />
              
              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
              >
                {isLoading ? <LoadingSpinner /> : null}
                {isLoading ? 'Đang soạn...' : 'Soạn giáo án'}
              </button>
            </form>
          </div>

          {/* Display Section */}
          <div className="lg:w-2/3" style={{height: 'calc(100vh - 150px)'}}>
             <LessonPlanDisplay
                lessonPlan={lessonPlan}
                exportFormat={formData.dinh_dang_xuat as 'Word (.docx)' | 'PDF (.pdf)'}
                fileName={formData.ten_bai}
                isLoading={isLoading}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
