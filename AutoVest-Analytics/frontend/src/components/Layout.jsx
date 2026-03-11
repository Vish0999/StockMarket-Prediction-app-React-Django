import Sidebar from "./Sidebar";
import Chatbot from "./Chatbot";
import  "./Layout.css";
import   "./Navbarr.css";

export default function Layout({ children }) {
  return (
    <div className="max-w-screen-2xl mx-auto w-full px-4 md:px-6 lg:px-8">
      <div className="flex gap-6 pt-6">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <Chatbot />
    </div>
  );
}