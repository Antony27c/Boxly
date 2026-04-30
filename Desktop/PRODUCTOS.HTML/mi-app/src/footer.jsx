function Footer() {
    return (
        <footer style={{
            textAlign: "center",
            padding: "1.5rem",
            marginTop: "2rem",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            color: "#8d99ae",
            fontFamily: "sans-serif",
            fontSize: "0.85rem"
        }}>
            <p>© {new Date().getFullYear()} Pablo Romano</p>
        </footer>
    )
}

export default Footer;