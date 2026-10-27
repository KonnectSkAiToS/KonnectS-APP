import fs from 'fs';

const filePath = './src/components/ProfileView.tsx';
if (fs.existsSync(filePath)) {
  let txt = fs.readFileSync(filePath, 'utf8');
  
  // Find where showFeedbackModal opens and verify context around it
  const target = `      {showFeedbackModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">`;
  
  const replacement = `            </motion.div>
         )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">`;

  if (txt.includes(target)) {
    txt = txt.replace(target, replacement);
    fs.writeFileSync(filePath, txt, 'utf8');
    console.log('Successfully aligned and closed the secondary views motion wrapper in ProfileView.tsx!');
  } else {
    console.error('Target string not found in ProfileView.tsx');
  }
} else {
  console.error('File not found');
}
